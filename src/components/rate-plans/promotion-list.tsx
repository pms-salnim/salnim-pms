
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
      return <>{promo.discountValue}% off</>;
    }
    return <>${promo.discountValue.toFixed(2)} off</>;
  };

  const getType = (promo: Promotion) => {
    return promo.couponCode ? 'Coupon' : 'Automatic';
  };

  return (
    <div className="rounded-md border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Discount Name</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Coupon Code</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                <Icons.Spinner className="mx-auto h-6 w-6 animate-spin" />
              </TableCell>
            </TableRow>
          ) : promotions.length > 0 ? (
            promotions.map((promo) => (
              <TableRow key={promo.id}>
                <TableCell className="font-medium">
                  <div>
                    <p className="text-sm font-semibold">{promo.name}</p>
                    <p className="text-xs text-muted-foreground max-w-xs truncate" title={promo.description}>
                      {promo.description}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="flex items-center font-medium">
                    {promo.discountType === 'percentage' ? (
                      <>
                        <Percent className="mr-1 h-4 w-4" /> {promo.discountValue}%
                      </>
                    ) : (
                      <>
                        <DollarSign className="mr-1 h-4 w-4" /> {promo.discountValue.toFixed(2)}
                      </>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={promo.promotionType === 'coupon' ? 'outline' : 'secondary'}
                    className={promo.promotionType === 'coupon' ? '' : 'bg-blue-100 text-blue-700 border-blue-300'}
                  >
                    <span className="flex items-center gap-1">
                      {promo.promotionType === 'coupon' ? (
                        <>
                          <Tag className="h-3 w-3" />
                          Coupon
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3" />
                          Automatic
                        </>
                      )}
                    </span>
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-mono">
                  {promo.promotionType === 'coupon' && promo.couponCode ? (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {promo.couponCode}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <span>
                    {(promo.timesUsed || 0)}{promo.usageLimit ? ` / ${promo.usageLimit}` : ' / Unlimited'}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={promo.active ? 'default' : 'outline'} 
                    className={promo.active ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}
                  >
                    {promo.active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                {t('list.no_promotions')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
