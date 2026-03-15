
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import type { Guest } from '@/types/guest';
import { getLoyaltyTier, defaultLoyaltyTiers } from '@/types/loyalty';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Edit, Trash2, Power } from "lucide-react";
import { Checkbox } from '../ui/checkbox';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Reservation } from '@/components/calendar/types';

interface LoyaltyListProps {
  guests: Guest[];
  isLoading: boolean;
  onAdjustPoints: (guest: Guest) => void;
  onRedeemPoints: (guest: Guest) => void;
  onViewProfile: (guest: Guest) => void; 
  selectedRowIds: Set<string>;
  onRowSelect: (guestId: string) => void;
  onSelectAll: (checked: boolean) => void;
  onBulkAdjustPoints: () => void;
  onBulkDelete: () => void;
  canManage?: boolean;
}

export default function LoyaltyList({ 
  guests, 
  isLoading, 
  onAdjustPoints,
  onRedeemPoints,
  onViewProfile, // New prop
  selectedRowIds,
  onRowSelect,
  onSelectAll,
  onBulkAdjustPoints,
  onBulkDelete,
  canManage,
}: LoyaltyListProps) {
  const { t } = useTranslation('pages/guests/loyalty/content');
  const { property } = useAuth();
  
  const numSelected = selectedRowIds.size;
  const isAllSelectedOnPage = numSelected > 0 && numSelected === guests.length;

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


  const redemptionRate = property?.loyaltyProgramSettings?.redemptionRate || 0.01;
  const currencySymbol = property?.currency || '$';
  const customTiers = property?.loyaltyProgramSettings?.tiers || defaultLoyaltyTiers;

  return (
    <div className="space-y-4">
      {numSelected > 0 && canManage && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border animate-in fade-in-50">
            <p className="text-sm font-medium">{t('list.bulk_actions.selected_text', { count: numSelected })}</p>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">{t('list.bulk_actions.button')} <Icons.DropdownArrow className="ml-2 h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onBulkAdjustPoints}>
                        <Icons.Edit className="mr-2 h-4 w-4" /> {t('list.bulk_actions.adjust_points')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={onBulkDelete}>
                        <Icons.Trash className="mr-2 h-4 w-4" /> {t('list.bulk_actions.delete_selected')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )}

      <div className="rounded-md border bg-card shadow-sm">
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
              <TableHead>{t('list.headers.guest_name')}</TableHead>
              <TableHead>{t('list.headers.tier')}</TableHead>
              <TableHead className="text-right">{t('list.headers.total_earned')}</TableHead>
              <TableHead className="text-right">{t('list.headers.redeemed')}</TableHead>
              <TableHead className="text-right">{t('list.headers.remaining_points')}</TableHead>
              <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            )}
            {!isLoading && guests.length === 0 && (
               <TableRow><TableCell colSpan={7} className="h-24 text-center">{t('list.empty_state')}</TableCell></TableRow>
            )}
            {!isLoading && guests.map((guest) => {
              const totalEarned = guest.totalPointsEarned || 0;
              const totalRedeemed = guest.totalPointsRedeemed || 0;
              const remainingPoints = guest.loyaltyPoints || 0;
              const tier = getLoyaltyTier(totalEarned, customTiers);
              
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
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={cn("font-semibold w-fit", tier.colorClass)}>{tier.name}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{remainingPoints.toFixed(2)} pts</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {totalEarned.toFixed(2)} <span className="text-xs text-muted-foreground">({currencySymbol}{(totalEarned * redemptionRate).toFixed(2)})</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {totalRedeemed.toFixed(2)} <span className="text-xs text-muted-foreground">({currencySymbol}{(totalRedeemed * redemptionRate).toFixed(2)})</span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {remainingPoints.toFixed(2)} <span className="text-xs text-muted-foreground">({currencySymbol}{(remainingPoints * redemptionRate).toFixed(2)})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => onViewProfile(guest)}>
                            <Icons.User className="mr-2 h-4 w-4" />
                            <span>{t('list.actions_menu.view_profile')}</span>
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => onAdjustPoints(guest)}>
                            <Icons.Edit className="mr-2 h-4 w-4" />
                            <span>{t('list.actions_menu.adjust_points')}</span>
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => onRedeemPoints(guest)}>
                            <Icons.DollarSign className="mr-2 h-4 w-4" />
                            <span>{t('list.actions_menu.redeem_points')}</span>
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
