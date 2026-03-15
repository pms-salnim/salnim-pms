
"use client";

import React from 'react';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from "@/components/ui/table";
import { useTranslation } from 'react-i18next';

interface PropertyOverviewTableProps {
  data: {
    totalBookings: number;
    occupancyRate: number;
    avgStayLength: number;
    averageDailyRate: number;
    revPAR: number;
  };
  currency: string;
}

export default function PropertyOverviewTable({ data, currency }: PropertyOverviewTableProps) {
  const { t } = useTranslation('performance-report-pdf');

  const overviewItems = [
    { label: t('property_overview.total_bookings'), value: data.totalBookings.toString() },
    { label: t('property_overview.occupancy_rate'), value: `${data.occupancyRate.toFixed(1)}%` },
    { label: t('property_overview.avg_stay'), value: `${data.avgStayLength.toFixed(1)} nights` },
    { label: t('property_overview.adr'), value: `${currency}${data.averageDailyRate.toFixed(2)}` },
    { label: t('property_overview.revpar'), value: `${currency}${data.revPAR.toFixed(2)}` },
  ];

  return (
    <div>
      <h3 className="text-xl font-bold mb-2">{t('property_overview.title')}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t('property_overview.description')}</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3">{t('table_headers.metric')}</TableHead>
              <TableHead className="text-right">{t('table_headers.value')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overviewItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell className="text-right font-bold">{item.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
