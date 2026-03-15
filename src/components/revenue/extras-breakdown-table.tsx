
"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { useTranslation } from 'react-i18next';

interface ExtrasBreakdown {
  name: string;
  quantity: number;
  total: number;
}

interface ExtrasBreakdownTableProps {
  data: ExtrasBreakdown[];
  currency: string;
}

export default function ExtrasBreakdownTable({ data, currency }: ExtrasBreakdownTableProps) {
  const { t } = useTranslation('performance-report-pdf');

  const totals = React.useMemo(() => {
    return data.reduce((acc, item) => {
        acc.quantity += item.quantity;
        acc.total += item.total;
        return acc;
    }, { quantity: 0, total: 0 });
  }, [data]);

  return (
    <div>
        <h3 className="text-xl font-bold mb-2">{t('extras_breakdown_title')}</h3>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('table_headers.extra_name')}</TableHead>
                        <TableHead className="text-right">{t('table_headers.quantity_sold')}</TableHead>
                        <TableHead className="text-right">{t('table_headers.total_revenue')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length > 0 ? data.map((item) => (
                        <TableRow key={item.name}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{currency}{item.total.toFixed(2)}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">{t('no_extras_data')}</TableCell></TableRow>
                    )}
                </TableBody>
                 {data.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">{t('table_headers.total_label')}</TableCell>
                            <TableCell className="text-right font-bold">{totals.quantity}</TableCell>
                            <TableCell className="text-right font-bold">{currency}{totals.total.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
        </div>
    </div>
  );
}
