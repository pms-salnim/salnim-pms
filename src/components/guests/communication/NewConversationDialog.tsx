"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, User, CalendarClock, Plus } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ConversationChannel = 'email' | 'whatsapp' | 'sms' | 'guest_portal';

export type ConversationSearchResult = {
  id: string;
  type: 'guest' | 'reservation';
  guestName: string;
  email: string;
  phone: string;
  reservationId?: string;
  reservationNumber?: string;
};

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onStartConversation: (result: ConversationSearchResult, channel: ConversationChannel) => void;
}

const CHANNELS: Array<{ key: ConversationChannel; label: string }> = [
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'sms', label: 'SMS' },
  { key: 'guest_portal', label: 'Guest Portal' },
];

export default function NewConversationDialog({ open, onOpenChange, propertyId, onStartConversation }: NewConversationDialogProps) {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ConversationSearchResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>('');
  const [showManualStarter, setShowManualStarter] = useState(false);
  const [manualChannel, setManualChannel] = useState<ConversationChannel>('email');
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setResults([]);
      setSelectedResultId('');
      setShowManualStarter(false);
      setManualChannel('email');
      setManualGuestName('');
      setManualEmail('');
      setManualPhone('');
    }
  }, [open]);

  const handleManualStart = () => {
    if (manualChannel === 'email' && !manualEmail.trim()) return;
    if ((manualChannel === 'whatsapp' || manualChannel === 'sms') && !manualPhone.trim()) return;

    const resolvedName = manualGuestName.trim() || 'New contact';
    const result: ConversationSearchResult = {
      id: `manual-${Date.now()}`,
      type: 'guest',
      guestName: resolvedName,
      email: manualChannel === 'email' ? manualEmail.trim() : manualEmail.trim(),
      phone: manualPhone.trim(),
    };

    onStartConversation(result, manualChannel);
  };

  const escapedQuery = useMemo(() => searchQuery.trim().replace(/,/g, ' ').replace(/%/g, ''), [searchQuery]);

  useEffect(() => {
    if (!open || !propertyId) return;

    const queryValue = escapedQuery;
    if (queryValue.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const guestSearch = supabase
          .from('guests')
          .select('id, first_name, last_name, email, phone')
          .eq('property_id', propertyId)
          .or(`first_name.ilike.%${queryValue}%,last_name.ilike.%${queryValue}%,email.ilike.%${queryValue}%,phone.ilike.%${queryValue}%`)
          .order('updated_at', { ascending: false })
          .limit(10);

        const reservationSearch = supabase
          .from('reservations')
          .select('id, reservation_number, guest_name, guest_email, guest_phone')
          .eq('property_id', propertyId)
          .or(`guest_name.ilike.%${queryValue}%,guest_email.ilike.%${queryValue}%,guest_phone.ilike.%${queryValue}%,reservation_number.ilike.%${queryValue}%`)
          .order('updated_at', { ascending: false })
          .limit(15);

        const [{ data: guestRows, error: guestError }, { data: reservationRows, error: reservationError }] = await Promise.all([
          guestSearch,
          reservationSearch,
        ]);

        if (guestError) throw guestError;
        if (reservationError) throw reservationError;
        if (isCancelled) return;

        const guestResults: ConversationSearchResult[] = (guestRows || []).map((guest: any) => ({
          id: `guest-${guest.id}`,
          type: 'guest',
          guestName: `${String(guest.first_name || '').trim()} ${String(guest.last_name || '').trim()}`.trim() || String(guest.email || 'Guest'),
          email: String(guest.email || '').trim(),
          phone: String(guest.phone || '').trim(),
        }));

        const reservationResults: ConversationSearchResult[] = (reservationRows || []).map((reservation: any) => ({
          id: `reservation-${reservation.id}`,
          type: 'reservation',
          guestName: String(reservation.guest_name || reservation.guest_email || 'Guest'),
          email: String(reservation.guest_email || '').trim(),
          phone: String(reservation.guest_phone || '').trim(),
          reservationId: String(reservation.id || ''),
          reservationNumber: String(reservation.reservation_number || ''),
        }));

        const merged = [...reservationResults, ...guestResults];
        const deduped = merged.filter((item, index, all) => {
          const key = `${item.type}:${item.guestName}:${item.email}:${item.phone}:${item.reservationId || ''}`.toLowerCase();
          return all.findIndex((candidate) => `${candidate.type}:${candidate.guestName}:${candidate.email}:${candidate.phone}:${candidate.reservationId || ''}`.toLowerCase() === key) === index;
        });

        setResults(deduped.slice(0, 20));
      } catch (error) {
        if (!isCancelled) {
          setResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [escapedQuery, open, propertyId, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start new conversation</DialogTitle>
          <DialogDescription>
            Search guests, reservation names, or reservation IDs. Select a contact, then choose channel.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search guest name, reservation name, reservation ID..."
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant={showManualStarter ? 'default' : 'outline'}
            size="icon"
            className="h-10 w-10"
            onClick={() => setShowManualStarter((value) => !value)}
            title="Add new contact"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showManualStarter && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New contact</p>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">No existing guest needed</Badge>
            </div>

            <Input
              value={manualGuestName}
              onChange={(event) => setManualGuestName(event.target.value)}
              placeholder="Guest name (optional)"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHANNELS.map((channel) => (
                <Button
                  key={channel.key}
                  type="button"
                  variant={manualChannel === channel.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setManualChannel(channel.key)}
                  disabled={channel.key === 'guest_portal'}
                  title={channel.key === 'guest_portal' ? 'Guest portal needs an existing reservation' : undefined}
                >
                  {channel.label}
                </Button>
              ))}
            </div>

            {manualChannel === 'email' && (
              <Input
                value={manualEmail}
                onChange={(event) => setManualEmail(event.target.value)}
                placeholder="Email address"
                type="email"
              />
            )}

            {(manualChannel === 'whatsapp' || manualChannel === 'sms') && (
              <Input
                value={manualPhone}
                onChange={(event) => setManualPhone(event.target.value)}
                placeholder={manualChannel === 'whatsapp' ? 'WhatsApp number' : 'Phone number'}
              />
            )}

            {manualChannel === 'guest_portal' && (
              <p className="text-xs text-slate-500">Use search results for guest portal, since it requires an existing reservation.</p>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleManualStart}
                disabled={
                  (manualChannel === 'email' && !manualEmail.trim()) ||
                  ((manualChannel === 'whatsapp' || manualChannel === 'sms') && !manualPhone.trim()) ||
                  manualChannel === 'guest_portal'
                }
              >
                Start conversation
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {isSearching && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {!isSearching && searchQuery.trim().length >= 2 && results.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No matches found.
            </div>
          )}

          {results.map((result) => {
            const isSelected = selectedResultId === result.id;
            return (
              <div
                key={result.id}
                className={cn(
                  'rounded-lg border border-slate-200 p-3 transition-colors',
                  isSelected ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/70'
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedResultId(result.id)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    {result.type === 'reservation' ? (
                      <CalendarClock className="h-4 w-4 text-blue-500" />
                    ) : (
                      <User className="h-4 w-4 text-slate-500" />
                    )}
                    <span className="text-sm font-semibold text-slate-800">{result.guestName}</span>
                    <Badge variant="outline" className="h-5 px-2 text-[10px]">
                      {result.type === 'reservation' ? 'Reservation' : 'Guest'}
                    </Badge>
                    {result.reservationNumber && (
                      <Badge variant="outline" className="h-5 px-2 text-[10px]">
                        {result.reservationNumber}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-0.5 text-xs text-slate-500">
                    <p>{result.email || '-'}</p>
                    <p>{result.phone || '-'}</p>
                    {result.reservationId && <p>ID: {result.reservationId}</p>}
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    {CHANNELS.map((channel) => (
                      <Button
                        key={channel.key}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onStartConversation(result, channel.key)}
                      >
                        {channel.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
