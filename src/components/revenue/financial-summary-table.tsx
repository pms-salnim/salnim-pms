
"use client";

import React from 'react';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from "@/components/ui/table";
import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface FinancialSummaryTableProps {
  data: {
    roomsRevenue: number;
    extrasRevenue: number;
    totalRevenueGross: number;
    totalDiscounts: number;
    totalTaxes: number;
    totalExpenses: number; 
    netRevenue: number;
    netProfit: number; 
    paidWithPointsValue: number;
  };
  currency: string;
}

export default function FinancialSummaryTable({ data, currency }: FinancialSummaryTableProps) {
  const { t } = useTranslation('performance-report-pdf');

  const financialItems = [
    { label: t('financial_summary.rooms_revenue'), value: data.roomsRevenue, description: t('financial_summary.rooms_revenue_desc') },
    { label: t('financial_summary.extras_revenue'), value: data.extrasRevenue, description: t('financial_summary.extras_revenue_desc') },
    { label: t('financial_summary.total_revenue_gross'), value: data.totalRevenueGross, description: t('financial_summary.total_revenue_gross_desc'), isBold: true },
    { label: t('financial_summary.discounts_applied'), value: -data.totalDiscounts, description: t('financial_summary.discounts_applied_desc'), isNegative: true },
    { label: t('financial_summary.paid_with_loyalty'), value: -data.paidWithPointsValue, description: t('financial_summary.paid_with_loyalty_desc'), isNegative: true, isInformational: true },
    { label: t('financial_summary.net_revenue'), value: data.netRevenue, description: t('financial_summary.net_revenue_desc'), isBold: true, isSubtotal: true },
    { label: t('financial_summary.total_expenses'), value: -data.totalExpenses, description: t('financial_summary.total_expenses_desc'), isNegative: true },
    { label: t('financial_summary.net_profit'), value: data.netProfit, description: t('financial_summary.net_profit_desc'), isBold: true, isTotal: true },
    { label: t('financial_summary.taxes_and_fees'), value: data.totalTaxes, description: t('financial_summary.taxes_and_fees_desc') },
  ];

  return (
    <div>
      <h3 className="text-xl font-bold mb-2">{t('financial_summary.title')}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t('financial_summary.description')}</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3">{t('table_headers.description')}</TableHead>
              <TableHead className="text-right">{t('table_headers.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {financialItems.map((item, index) => {
              const isNetProfit = item.label === t('financial_summary.net_profit');
              const isLoss = isNetProfit && item.value < 0;

              return (
              <TableRow key={index} className={item.isTotal ? "bg-muted/50 hover:bg-muted/60" : ""}>
                <TableCell className={`${item.isBold ? "font-bold" : "font-medium"} ${item.isSubtotal ? 'pl-4' : ''}`}>
                  {item.label}
                  <p className="text-xs text-muted-foreground font-normal">{item.description}</p>
                </TableCell>
                <TableCell className={`text-right font-mono ${item.isNegative ? 'text-destructive' : ''} ${item.isBold ? 'font-bold' : ''}`}>
                  <div className="flex items-center justify-end gap-2">
                    {isNetProfit && (
                      <Badge variant={isLoss ? 'destructive' : 'default'} className={cn(!isLoss && 'bg-green-100 text-green-700 border-green-300')}>
                        {isLoss ? t('financial_summary.loss') : t('financial_summary.benefit')}
                      </Badge>
                    )}
                    <span>
                      {item.isNegative ? '-' : ''}{currency}{(Math.abs(item.value) || 0).toFixed(2)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
