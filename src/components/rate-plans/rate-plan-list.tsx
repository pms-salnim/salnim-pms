
"use client";

import React, { useState, useMemo } from 'react';
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
import { MoreHorizontal, Edit, Trash2, Copy, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react"; 
import { Icons } from "@/components/icons";
import type { RatePlan } from '@/types/ratePlan';
import type { RoomType } from '@/types/roomType';
import type { Property } from '@/types/property';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { format, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RatePlanListProps {
  ratePlans: RatePlan[];
  roomTypes: RoomType[]; 
  onEditRatePlan: (ratePlan: RatePlan) => void;
  onDeleteRatePlan: (ratePlan: RatePlan) => void;
  isLoading: boolean;
  propertySettings: Property | null;
  canManage?: boolean;
}

export default function RatePlanList({ ratePlans, roomTypes, onEditRatePlan, onDeleteRatePlan, isLoading, propertySettings, canManage }: RatePlanListProps) {
  const { property } = useAuth();
  const { t } = useTranslation('pages/rate-plans/all/content');
  const currencySymbol = property?.currency || '$';
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set(roomTypes.map(rt => rt.id)));

  const toggleRoomType = (roomTypeId: string) => {
    setExpandedRoomTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomTypeId)) {
        newSet.delete(roomTypeId);
      } else {
        newSet.add(roomTypeId);
      }
      return newSet;
    });
  };

  const ratePlansByRoomType = useMemo(() => {
    const grouped = new Map<string, RatePlan[]>();
    
    ratePlans.forEach(plan => {
      if (!grouped.has(plan.roomTypeId)) {
        grouped.set(plan.roomTypeId, []);
      }
      grouped.get(plan.roomTypeId)?.push(plan);
    });

    return grouped;
  }, [ratePlans]);

  const getRoomTypeName = (roomTypeId: string): string => {
    return roomTypes.find(rt => rt.id === roomTypeId)?.name || "Unknown Type";
  };

  const getPricingSummary = (plan: RatePlan): string => {
    if (plan.pricingMethod === 'per_night') {
        return t('list.pricing_summary.per_night', { price: `${currencySymbol}${(plan.basePrice || 0).toFixed(2)}` });
    }

    const pricing = plan.pricingPerGuest;
    if (!pricing || typeof pricing !== 'object' || Object.keys(pricing).length === 0) {
      return t('list.pricing_summary.not_set');
    }
    const entries = Object.entries(pricing);
    return entries
      .slice(0, 2)
      .map(([key, value]) => t('list.pricing_summary.per_guest', { guests: key, price: `${currencySymbol}${value.toFixed(2)}` }))
      .join(", ") + (entries.length > 2 ? "..." : "");
  };
  
  const getStatus = (plan: RatePlan): { text: string; className: string } => {
    const now = new Date();
    // Convert to Date if it's a string, or use as-is if already a Date object
    const startDate = typeof plan.startDate === 'string' ? new Date(plan.startDate) : plan.startDate;
    const endDate = typeof plan.endDate === 'string' ? new Date(plan.endDate) : plan.endDate;

    if (!startDate) {
        return { text: t('list.status_inactive'), className: 'bg-gray-100 text-gray-700 border-gray-300' };
    }

    if (now >= startDate && (!endDate || now <= endDate)) {
      return { text: t('list.status_active'), className: 'bg-green-100 text-green-700 border-green-300' };
    }

    if (now < startDate) {
      return { text: t('list.status_upcoming'), className: 'bg-blue-100 text-blue-700 border-blue-300' };
    }
    
    return { text: t('list.status_expired'), className: 'bg-red-100 text-red-700 border-red-300' };
  };

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="rounded-md border shadow-sm bg-card p-12 text-center">
          <Icons.Spinner className="mx-auto h-8 w-8 animate-spin" />
        </div>
      )}
      
      {!isLoading && ratePlans.length === 0 && (
        <div className="rounded-md border shadow-sm bg-card p-12 text-center text-muted-foreground">
          {t('list.no_plans_message')}
        </div>
      )}

      {!isLoading && roomTypes.map(roomType => {
        const plans = ratePlansByRoomType.get(roomType.id) || [];
        if (plans.length === 0) return null;

        const isExpanded = expandedRoomTypes.has(roomType.id);

        return (
          <Card key={roomType.id} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors border-b"
              onClick={() => toggleRoomType(roomType.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <CardTitle className="text-xl">{roomType.name}</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('list.headers.plan_name')}</TableHead>
                      <TableHead>Pricing Method</TableHead>
                      <TableHead>{t('list.headers.pricing')}</TableHead>
                      <TableHead>Adjustment</TableHead>
                      <TableHead>{t('list.headers.validity')}</TableHead>
                      <TableHead className="text-center">{t('list.headers.default')}</TableHead>
                      <TableHead>{t('list.headers.status')}</TableHead> 
                      <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => {
                      const status = getStatus(plan);
                      const startDate = plan.startDate ? format(plan.startDate instanceof Date ? plan.startDate : new Date(plan.startDate), 'PP') : 'N/A';
                      const endDate = plan.endDate ? format(plan.endDate instanceof Date ? plan.endDate : new Date(plan.endDate), 'PP') : 'Open';
                      const isDerived = plan.is_derived_from_base;
                      
                      let adjustmentLabel = '-';
                      if (isDerived && plan.adjustment_type && plan.adjustment_type !== 'none') {
                        if (plan.adjustment_type === 'fixed') {
                          adjustmentLabel = `+${currencySymbol}${(plan.adjustment_value || 0).toFixed(2)}`;
                        } else if (plan.adjustment_type === 'percentage') {
                          adjustmentLabel = `+${plan.adjustment_value || 0}%`;
                        }
                      }
                      
                      return (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.planName}</TableCell>
                          <TableCell>
                            <Badge variant={isDerived ? "default" : "outline"} className={isDerived ? "bg-blue-100 text-blue-800" : ""}>
                              {isDerived ? "Base Rate Derived" : "Legacy"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{getPricingSummary(plan)}</TableCell>
                          <TableCell className="text-sm">
                            {isDerived ? (
                              <div className="text-sm">
                                <div className="font-medium capitalize">{plan.adjustment_type === 'fixed' ? 'Fixed' : plan.adjustment_type === 'percentage' ? 'Percentage' : 'None'}</div>
                                <div className="text-muted-foreground">{adjustmentLabel}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{startDate} - {endDate}</TableCell>
                          <TableCell className="text-center">
                            {plan.default ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={status.className}>
                              {status.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onEditRatePlan(plan)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>{t('list.actions_menu.edit')}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => alert('Duplicate plan: ' + plan.planName + ' (Placeholder)')}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    <span>{t('list.actions_menu.duplicate')}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive hover:!text-destructive-foreground focus:!text-destructive-foreground"
                                    onClick={() => onDeleteRatePlan(plan)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>{t('list.actions_menu.delete')}</span>
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
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
