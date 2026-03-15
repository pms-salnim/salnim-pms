
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import type { Guest, GuestTag } from "@/types/guest";
import { MoreHorizontal, Edit, Trash2, Power } from "lucide-react";
import { format, parseISO } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { Checkbox } from '../ui/checkbox';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Reservation } from '@/components/calendar/types';

interface GuestListProps {
  guests: Guest[];
  reservations: Reservation[];
  onEditGuest: (guest: Guest) => void;
  onViewProfile: (guest: Guest) => void;
  onDeleteGuest: (guest: Guest) => void;
  isLoading: boolean;
  canManage?: boolean;
  selectedRowIds: Set<string>;
  onRowSelect: (guestId: string) => void;
  onSelectAll: (checked: boolean) => void;
  onBulkDelete: () => void;
  onBulkAddTag: () => void;
}

function GuestTagBadge({ tag }: { tag: GuestTag }) {
  const IconComponent = tag.icon ? Icons[tag.icon] : null;
  let badgeVariant: "default" | "secondary" | "outline" = "secondary";
  if (tag.label === "VIP") badgeVariant = "default";

  return (
    <Badge variant={badgeVariant} className="mr-1 capitalize text-xs whitespace-nowrap">
      {IconComponent && <IconComponent className="mr-1 h-3 w-3" />}
      {tag.label}
    </Badge>
  );
}

export default function GuestList({ 
    guests, 
    reservations,
    onEditGuest, 
    onViewProfile, 
    onDeleteGuest, 
    isLoading, 
    canManage,
    selectedRowIds,
    onRowSelect,
    onSelectAll,
    onBulkDelete,
    onBulkAddTag,
}: GuestListProps) {
  const { t } = useTranslation('pages/guests/all/content');
  const { property } = useAuth();

  const handleToggleLoyaltyEnrollment = async (guest: Guest) => {
    if (!canManage) return;
    if (!property?.loyaltyProgramSettings?.enabled) {
        toast({
            title: t('toasts.loyalty_disabled_title'),
            description: t('toasts.loyalty_disabled_description'),
            variant: "default",
        });
        return;
    }
    const newStatus = guest.loyaltyStatus === 'enrolled' ? 'not-enrolled' : 'enrolled';
    try {
        const guestRef = doc(db, 'guests', guest.id);
        await updateDoc(guestRef, {
            loyaltyStatus: newStatus,
            updatedAt: serverTimestamp(),
        });
        toast({
            title: t('toasts.success_title'),
            description: newStatus 
                ? t('toasts.loyalty_enroll_success', { name: guest.fullName }) 
                : t('toasts.loyalty_unenroll_success', { name: guest.fullName }),
        });
    } catch (error) {
        toast({ title: t('toasts.error_title'), description: t('toasts.loyalty_update_error'), variant: "destructive" });
        console.error("Error updating loyalty status:", error);
    }
  };


  const formatDateField = (dateField?: string | Timestamp | Date): string => {
    if (!dateField) return '-';
    if (typeof dateField === 'string') {
      try { return format(parseISO(dateField), 'PPP'); } catch { return dateField; }
    }
    if (dateField instanceof Date) { return format(dateField, 'PPP'); }
    // Assume Firestore Timestamp
    if (typeof (dateField as Timestamp).toDate === 'function') {
        return format((dateField as Timestamp).toDate(), 'PPP');
    }
    return '-';
  };

  const numSelected = selectedRowIds.size;
  const isAllSelectedOnPage = numSelected > 0 && numSelected === guests.length;

  return (
    <div className="space-y-4">
      {numSelected > 0 && canManage && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border animate-in fade-in-50">
            <p className="text-sm font-medium">{t('list.bulk_actions.selected_text', { count: numSelected })}</p>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">{t('list.bulk_actions.button_text')} <Icons.DropdownArrow className="ml-2 h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onBulkAddTag}>
                        <Icons.Tag className="mr-2 h-4 w-4" /> {t('list.bulk_actions.add_tag')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={onBulkDelete}>
                        <Icons.Trash className="mr-2 h-4 w-4" /> {t('list.bulk_actions.delete_selected')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )}

      <div className="rounded-lg border shadow-sm bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelectedOnPage ? true : numSelected > 0 ? 'indeterminate' : false}
                  onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  aria-label="Select all"
                  disabled={!canManage}
                />
              </TableHead>
              <TableHead>{t('list.headers.full_name')}</TableHead>
              <TableHead>{t('list.headers.email')}</TableHead>
              <TableHead>{t('list.headers.phone')}</TableHead>
              <TableHead>{t('list.headers.nationality')}</TableHead>
              <TableHead className="text-center">{t('list.headers.reservations')}</TableHead>
              <TableHead>{t('list.headers.last_stay')}</TableHead>
              <TableHead>{t('list.headers.tags')}</TableHead>
              <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            )}
            {!isLoading && guests.map((guest) => {
              const guestReservations = reservations.filter(res => res.guestEmail === guest.email);
              const reservationCount = guestReservations.length;
              return (
              <TableRow key={guest.id} data-state={selectedRowIds.has(guest.id) && "selected"}>
                <TableCell>
                  <Checkbox
                    checked={selectedRowIds.has(guest.id)}
                    onCheckedChange={() => onRowSelect(guest.id)}
                    aria-label={`Select guest ${guest.fullName}`}
                    disabled={!canManage}
                  />
                </TableCell>
                <TableCell className="font-medium">{guest.fullName}</TableCell>
                <TableCell>{guest.email}</TableCell>
                <TableCell>{guest.phone || "-"}</TableCell>
                <TableCell>{guest.nationality || "-"}</TableCell>
                <TableCell className="text-center">{reservationCount}</TableCell>
                <TableCell>{formatDateField(guest.lastStayDate)}</TableCell>
                <TableCell className="max-w-[150px]">
                  <div className="flex flex-wrap gap-1">
                    {guest.tags && guest.tags.length > 0
                      ? guest.tags.map((tag) => <GuestTagBadge key={tag.id} tag={tag} />)
                      : <span className="text-xs text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewProfile(guest)}><Icons.Eye className="mr-2 h-4 w-4" /><span>{t('list.actions_menu.view_profile')}</span></DropdownMenuItem>
                      {canManage && (
                          <>
                              <DropdownMenuItem onClick={() => onEditGuest(guest)}><Icons.Edit className="mr-2 h-4 w-4" /><span>{t('list.actions_menu.edit_guest')}</span></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleLoyaltyEnrollment(guest)}>
                                  <Icons.Star className="mr-2 h-4 w-4" />
                                  <span>{guest.loyaltyStatus === 'enrolled' ? t('list.actions_menu.unenroll_loyalty') : t('list.actions_menu.enroll_loyalty')}</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteGuest(guest)}><Icons.Trash className="mr-2 h-4 w-4" /><span>{t('list.actions_menu.delete_guest')}</span></DropdownMenuItem>
                          </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              )
            })}
            {!isLoading && guests.length === 0 && (
              <TableRow><TableCell colSpan={9} className="h-24 text-center">{t('list.no_guests_message')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
         {!isLoading && guests.length > 0 && (
          <div className="flex items-center justify-center space-x-2 p-4 border-t">
          </div>
        )}
      </div>
    </div>
  );
}
