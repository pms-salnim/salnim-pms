
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { useTranslation } from 'react-i18next';

interface RevenueCardsProps {
  totalRevenue: number;
  stayRevenue: number;
  pendingRevenue: number;
  totalBookings: number;
  averageDailyRate: number;
  occupancyRate: number;
  revPAR: number;
  canceledBookingsValue: number;
  currency: string;
  isLoading: boolean;
}

export default function RevenueCards({
  totalRevenue,
  stayRevenue,
  pendingRevenue,
  totalBookings,
  averageDailyRate,
  occupancyRate,
  revPAR,
  canceledBookingsValue,
  currency,
  isLoading,
}: RevenueCardsProps) {
  const { t } = useTranslation('pages/revenue/overview/content');

  const formatCurrency = (value: number) => {
    return `${currency}${value.toFixed(2)}`;
  };

  const kpiData = [
    { title: t('cards.total_revenue.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : formatCurrency(stayRevenue), description: t('cards.total_revenue.description'), icon: Icons.DollarSign, dataAiHint: "money revenue" },
    { title: t('cards.pending_revenue.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : formatCurrency(pendingRevenue), description: t('cards.pending_revenue.description'), icon: Icons.Hourglass, dataAiHint: "hourglass time" },
    { title: t('cards.total_bookings.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : totalBookings.toString(), description: t('cards.total_bookings.description'), icon: Icons.CalendarCheck, dataAiHint: "calendar checkmark" },
    { title: t('cards.adr.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : formatCurrency(averageDailyRate), description: t('cards.adr.description'), icon: Icons.TrendingUp, dataAiHint: "graph statistics" },
    { title: t('cards.occupancy_rate.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : `${occupancyRate.toFixed(1)}%`, description: t('cards.occupancy_rate.description'), icon: Icons.BedDouble, dataAiHint: "hotel bed" },
    { title: t('cards.revpar.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : formatCurrency(revPAR), description: t('cards.revpar.description'), icon: Icons.DollarSign, dataAiHint: "dollar chart" },
    { title: t('cards.canceled_bookings.title'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : formatCurrency(canceledBookingsValue), description: t('cards.canceled_bookings.description'), icon: Icons.XCircle, dataAiHint: "cancel cross" },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {kpiData.map((kpi) => {
        const IconComponent = kpi.icon;
        return (
          <Card key={kpi.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" data-ai-hint={kpi.dataAiHint} />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              <p className="text-xs text-muted-foreground pt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
