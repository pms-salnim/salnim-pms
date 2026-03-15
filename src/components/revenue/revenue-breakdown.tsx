
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from 'react-i18next';

interface BreakdownItem {
  label: string;
  revenue: number;
  percentage: number;
  colorClass: string;
}

interface RevenueBreakdownProps {
  breakdownDataByRoomType: BreakdownItem[];
  breakdownDataBySource: BreakdownItem[];
  currency?: string;
}

const BreakdownItemDisplay: React.FC<BreakdownItem & { currency: string }> = ({ label, revenue, percentage, colorClass, currency }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">{currency}{revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({percentage.toFixed(1)}%)</span>
    </div>
    <Progress value={percentage} aria-label={`${label} revenue percentage`} className="h-2 [&>div]:bg-primary" indicatorClassName={colorClass} />
  </div>
);

export default function RevenueBreakdown({ breakdownDataByRoomType, breakdownDataBySource, currency = "$" }: RevenueBreakdownProps) {
  const { t } = useTranslation('pages/revenue/overview/content');

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('breakdown.room_type_title')}</CardTitle>
          <CardDescription>{t('breakdown.room_type_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(breakdownDataByRoomType || []).length > 0 ? breakdownDataByRoomType.map((item) => (
            <BreakdownItemDisplay key={item.label} {...item} currency={currency} />
          )) : (
             <p className="text-sm text-muted-foreground col-span-full text-center py-4">{t('breakdown.empty_state_room')}</p>
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('breakdown.source_title')}</CardTitle>
          <CardDescription>{t('breakdown.source_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {(breakdownDataBySource || []).length > 0 ? breakdownDataBySource.map((item) => (
            <BreakdownItemDisplay key={item.label} {...item} currency={currency} />
          )) : (
             <p className="text-sm text-muted-foreground col-span-full text-center py-4">{t('breakdown.empty_state_source')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
