
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
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Tag, Percent, DollarSign, Globe } from "lucide-react"; 
import { Icons } from "@/components/icons";
import type { Promotion } from '@/types/promotion';
import type { RatePlan } from '@/types/ratePlan';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface PromotionListProps {
  promotions: Promotion[];
  ratePlans: RatePlan[];
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
  isLoading: boolean;
  canManage?: boolean;
}

export default function PromotionList({ promotions, ratePlans, onEdit, onDelete, isLoading, canManage }: PromotionListProps) {
  const { t } = useTranslation('pages/rate-plans/promotions/content');

  const getDiscountDisplay = (promo: Promotion) => {
    if (promo.discountType === 'percentage') {
      return <><Percent className="mr-1 h-3 w-3" /> {promo.discountValue}% off</>;
    }
    return <><DollarSign className="mr-1 h-3 w-3" /> ${promo.discountValue.toFixed(2)} off</>;
  };

  return (
    <div className="rounded-md border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.headers.name')}</TableHead>
            <TableHead>{t('list.headers.discount')}</TableHead>
            <TableHead>{t('list.headers.type')}</TableHead>
            <TableHead>{t('list.headers.usage')}</TableHead>
            <TableHead>{t('list.headers.status')}</TableHead>
            <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
          ) : promotions.length > 0 ? (
            promotions.map((promo) => (
              <TableRow key={promo.id}>
                <TableCell className="font-medium">
                    {promo.name}
                    <p className="text-xs text-muted-foreground max-w-xs truncate" title={promo.description}>{promo.description}</p>
                </TableCell>
                <TableCell><span className="flex items-center text-sm">{getDiscountDisplay(promo)}</span></TableCell>
                <TableCell>
                  {promo.couponCode ? (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <Tag className="h-3 w-3"/>
                      {promo.couponCode}
                    </Badge>
                  ) : (<Badge variant="secondary" className="flex items-center gap-1 w-fit"><Globe className="h-3 w-3"/>{t('list.types.automatic')}</Badge>)}
                </TableCell>
                <TableCell className="text-sm">
                  {(promo.timesUsed || 0)}{promo.usageLimit ? ` / ${promo.usageLimit}` : ''}
                </TableCell>
                <TableCell>
                  <Badge variant={promo.active ? 'default' : 'outline'} className={promo.active ? 'bg-green-100 text-green-700 border-green-300' : ''}>
                    {promo.active ? t('list.status.active') : t('list.status.inactive')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(promo)}>
                          <Edit className="mr-2 h-4 w-4" /> {t('list.actions_menu.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(promo)}>
                          <Trash2 className="mr-2 h-4 w-4" /> {t('list.actions_menu.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={6} className="h-24 text-center">{t('list.no_promotions')}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
