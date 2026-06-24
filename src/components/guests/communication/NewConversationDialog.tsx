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

const normalizeText = (value: unknown): string => String(value || '').trim();

const buildCombinedName = (...parts: Array<unknown>): string =>
  parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildCommaName = (firstName: unknown, lastName: unknown): string => {
  const first = normalizeText(firstName);
  const last = normalizeText(lastName);
  if (!first && !last) return '';
  if (!first) return last;
  if (!last) return first;
  return `${first}, ${last}`;
};

const valueMatches = (query: string, value: unknown): boolean => {
  const normalizedQuery = normalizeText(query).toLowerCase();
  if (!normalizedQuery) return true;
  return normalizeText(value).toLowerCase().includes(normalizedQuery);
};

const guestNameFromRow = (guest: any): string =>
  normalizeText(guest?.name)
  || normalizeText(guest?.full_name)
  || buildCombinedName(guest?.first_name, guest?.last_name)
  || normalizeText(guest?.email)
  || 'Guest';

const reservationNameFromRow = (reservation: any): string =>
  normalizeText(reservation?.guest_name)
  || buildCombinedName(reservation?.guest_first_name, reservation?.guest_last_name)
  || buildCombinedName(reservation?.first_name, reservation?.last_name)
  || normalizeText(reservation?.guest_email)
  || 'Guest';

const guestMatchesQuery = (guest: any, query: string): boolean => {
  const firstName = normalizeText(guest?.first_name);
  const lastName = normalizeText(guest?.last_name);
  const candidates = [
    guest?.name,
    guest?.full_name,
    buildCombinedName(firstName, lastName),
    buildCommaName(firstName, lastName),
    guest?.email,
    guest?.phone,
  ];
  return candidates.some((candidate) => valueMatches(query, candidate));
};

const reservationMatchesQuery = (reservation: any, query: string): boolean => {
  const firstName = normalizeText(reservation?.guest_first_name || reservation?.first_name);
  const lastName = normalizeText(reservation?.guest_last_name || reservation?.last_name);
  const candidates = [
    reservation?.guest_name,
    buildCombinedName(firstName, lastName),
    buildCommaName(firstName, lastName),
    reservation?.guest_email,
    reservation?.guest_phone,
    reservation?.reservation_number,
  ];
  return candidates.some((candidate) => valueMatches(query, candidate));
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const json = await response.json();
    return String(json?.error || json?.details || `Request failed with status ${response.status}`);
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

export default function NewConversationDialog({ open, onOpenChange, propertyId, onStartConversation }: NewConversationDialogProps) {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [results, setResults] = useState<ConversationSearchResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>('');
  const [showManualStarter, setShowManualStarter] = useState(false);
  const [manualChannel, setManualChannel] = useState<ConversationChannel>('email');
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [isQueryEmpty, setIsQueryEmpty] = useState(true);

  const fetchConversationResults = async (query: string): Promise<ConversationSearchResult[]> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Missing session');
    }

    const response = await fetch('/api/communication/conversation-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        propertyId,
        query,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.results)) {
      return [];
    }

    return payload.results as ConversationSearchResult[];
  };

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
      setIsQueryEmpty(true);
    }
  }, [open]);

  // Load recent reservations and guests when modal opens
  useEffect(() => {
    if (!open || !propertyId) return;

    let isCancelled = false;
    const loadRecentResults = async () => {
      setIsLoadingRecent(true);
      try {
        const recentResults = await fetchConversationResults('');
        if (!isCancelled) {
          setResults(recentResults);
        }
      } catch (error: any) {
        console.error('Failed to load recent results:', {
          message: error?.message || null,
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null,
        });
        if (!isCancelled) {
          setResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRecent(false);
        }
      }
    };

    loadRecentResults();

    return () => {
      isCancelled = true;
    };
  }, [open, propertyId, supabase]);

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

  const escapedQuery = useMemo(() => searchQuery.trim().replace(/%/g, ''), [searchQuery]);
  const hasActiveSearch = escapedQuery.length >= 2;
  const reservationResults = useMemo(
    () => results.filter((result) => result.type === 'reservation'),
    [results]
  );
  const guestResults = useMemo(
    () => results.filter((result) => result.type === 'guest'),
    [results]
  );
  const totalResults = results.length;

  useEffect(() => {
    setIsQueryEmpty(escapedQuery.length === 0);
  }, [escapedQuery]);

  // Search effect - only runs when query has 2+ characters
  useEffect(() => {
    if (!open || !propertyId) return;

    const queryValue = escapedQuery;
    if (queryValue.length < 2) {
      // If query is empty, keep showing recent results (already loaded)
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await fetchConversationResults(queryValue);
        if (isCancelled) return;

        setResults(searchResults);
      } catch (error: any) {
        console.error('Failed to search conversation targets:', {
          message: error?.message || null,
          details: error?.details || null,
          hint: error?.hint || null,
          code: error?.code || null,
        });
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
      <DialogContent className="sm:max-w-3xl border-slate-200 bg-slate-50 p-0">
        <DialogHeader>
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <DialogTitle className="text-xl text-slate-900">Start new conversation</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">
              Search guests, reservation names, or reservation IDs. Select a contact, then choose channel.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-5 pt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search guest name, reservation name, reservation ID..."
                className="h-11 rounded-xl border-slate-300 bg-white pl-10 shadow-sm"
              />
            </div>
            <Button
              type="button"
              variant={showManualStarter ? 'default' : 'outline'}
              size="icon"
              className="h-11 w-11 rounded-xl"
              onClick={() => setShowManualStarter((value) => !value)}
              title="Add new contact"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span>
              {hasActiveSearch
                ? `${totalResults} match${totalResults === 1 ? '' : 'es'} found`
                : 'Showing recent guests and reservations'}
            </span>
            <span>{showManualStarter ? 'Manual contact enabled' : 'Select a result to choose channel'}</span>
          </div>

          {showManualStarter && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

          <div className="max-h-[430px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 pr-2">
            {isLoadingRecent && !searchQuery.trim() && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recent guests and reservations...
              </div>
            )}

            {isSearching && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {!isSearching && !isLoadingRecent && searchQuery.trim().length >= 2 && results.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No matches found for "{searchQuery.trim()}".
              </div>
            )}

            {!isSearching && !isLoadingRecent && isQueryEmpty && results.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No recent guests or reservations found.
              </div>
            )}

            {results.length > 0 && isQueryEmpty && (
              <div className="px-1 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Recent Guests & Reservations
              </div>
            )}

            {reservationResults.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reservations</div>
                {reservationResults.map((result) => {
                  const isSelected = selectedResultId === result.id;
                  return (
                    <div
                      key={result.id}
                      className={cn(
                        'rounded-xl border p-3 transition-all',
                        isSelected
                          ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedResultId(result.id)}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-semibold text-slate-900">{result.guestName}</span>
                          <Badge variant="outline" className="h-5 border-blue-200 bg-blue-50 px-2 text-[10px] text-blue-700">Reservation</Badge>
                          {result.reservationNumber && (
                            <Badge variant="outline" className="h-5 px-2 text-[10px]">
                              #{result.reservationNumber}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                          <p className="truncate"><span className="text-slate-400">Email:</span> {result.email || 'Not set'}</p>
                          <p className="truncate"><span className="text-slate-400">Phone:</span> {result.phone || 'Not set'}</p>
                          <p className="truncate sm:col-span-2"><span className="text-slate-400">Reservation ID:</span> {result.reservationId || 'Not set'}</p>
                        </div>
                      </button>

                      {isSelected && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-blue-200 pt-3">
                          {CHANNELS.map((channel) => (
                            <Button
                              key={channel.key}
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-full text-xs"
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
            )}

            {guestResults.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Guests</div>
                {guestResults.map((result) => {
                  const isSelected = selectedResultId === result.id;
                  return (
                    <div
                      key={result.id}
                      className={cn(
                        'rounded-xl border p-3 transition-all',
                        isSelected
                          ? 'border-slate-400 bg-slate-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedResultId(result.id)}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-900">{result.guestName}</span>
                          <Badge variant="outline" className="h-5 px-2 text-[10px]">Guest</Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                          <p className="truncate"><span className="text-slate-400">Email:</span> {result.email || 'Not set'}</p>
                          <p className="truncate"><span className="text-slate-400">Phone:</span> {result.phone || 'Not set'}</p>
                        </div>
                      </button>

                      {isSelected && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                          {CHANNELS.map((channel) => (
                            <Button
                              key={channel.key}
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-full text-xs"
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
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
