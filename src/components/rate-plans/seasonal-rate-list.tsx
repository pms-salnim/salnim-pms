
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
import { MoreHorizontal, Edit, Trash2, Power } from "lucide-react"; 
import { Icons } from "@/components/icons";
import type { SeasonalRate } from '@/types/seasonalRate';
import type { RatePlan } from '@/types/ratePlan';
import type { RoomType } from '@/types/roomType';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SeasonalRateListProps {
  seasonalRates: SeasonalRate[];
  ratePlans: RatePlan[];
  roomTypes: RoomType[]; 
  onEdit: (rate: SeasonalRate) => void;
  onDelete: (rate: SeasonalRate) => void;
  isLoading: boolean;
  canManage?: boolean;
}

export default function SeasonalRateList({ seasonalRates, ratePlans, roomTypes, onEdit, onDelete, isLoading, canManage }: SeasonalRateListProps) {
  const { property } = useAuth();
  const { t } = useTranslation('pages/rate-plans/seasonal/content');
  const currencySymbol = property?.currency || '$';

  const getRatePlanDetails = (ratePlanId: string) => {
    const plan = ratePlans.find(rp => rp.id === ratePlanId);
    if (!plan) return { name: t('list.unknown_plan'), roomTypeName: "N/A", method: 'per_night' as const };
    const roomType = roomTypes.find(rt => rt.id === plan.roomTypeId);
    return { name: plan.planName, roomTypeName: roomType?.name || "N/A", method: plan.pricingMethod };
  };

  const getPricingSummary = (rate: SeasonalRate, method: RatePlan['pricingMethod']): string => {
    if (method === 'per_night') {
        if (rate.basePrice !== undefined && rate.basePrice !== null) {
            return `${currencySymbol}${rate.basePrice.toFixed(2)} / night`;
        }
    } else { // per_guest
        const pricing = rate.pricingPerGuest;
        if (pricing && typeof pricing === 'object' && Object.keys(pricing).length > 0) {
            const entries = Object.entries(pricing);
            return entries
                .slice(0, 2)
                .map(([key, value]) => `${key}G: ${currencySymbol}${value.toFixed(2)}`)
                .join(", ") + (entries.length > 2 ? "..." : "");
        }
    }
    return t('list.not_set');
  };

  const handleToggleStatus = async (rate: SeasonalRate) => {
    if (!canManage) return;
    const newStatus = !rate.active;
    try {
        const docRef = doc(db, "seasonalRates", rate.id);
        await updateDoc(docRef, { active: newStatus });
        toast({ title: t('toasts.success_status_update_title'), description: t('toasts.success_status_update_description', { name: rate.name, status: newStatus ? t('list.status.active') : t('list.status.inactive') }) });
    } catch(err) {
        console.error("Error toggling status:", err);
        toast({ title: t('toasts.error_status_update_title'), description: t('toasts.error_status_update_description'), variant: 'destructive' });
    }
  }

  return (
    <div className="rounded-md border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.headers.season_name')}</TableHead>
            <TableHead>{t('list.headers.date_range')}</TableHead>
            <TableHead>{t('list.headers.rate_plan')}</TableHead>
            <TableHead>{t('list.headers.pricing')}</TableHead>
            <TableHead>{t('list.headers.status')}</TableHead>
            <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
          ) : seasonalRates.length > 0 ? (
            seasonalRates.map((rate) => {
              const { name: ratePlanName, roomTypeName, method } = getRatePlanDetails(rate.ratePlanId);
              return (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">{rate.name}</TableCell>
                  <TableCell>{format(rate.startDate, "PP")} - {format(rate.endDate, "PP")}</TableCell>
                  <TableCell>
                    <div>{ratePlanName}</div>
                    <div className="text-xs text-muted-foreground">{roomTypeName}</div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{getPricingSummary(rate, method)}</TableCell>
                  <TableCell>
                    <Badge variant={rate.active ? 'default' : 'outline'} className={rate.active ? 'bg-green-100 text-green-700 border-green-300' : ''}>
                      {rate.active ? t('list.status.active') : t('list.status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(rate)}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>{t('list.actions.edit')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(rate)}>
                            <Power className="mr-2 h-4 w-4" />
                            <span>{rate.active ? t('list.actions.deactivate') : t('list.actions.activate')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete(rate)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>{t('list.actions.delete')}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('list.no_rules')}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
