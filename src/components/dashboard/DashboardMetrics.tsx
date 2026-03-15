"use client";

import React from "react";
import { Icons } from "@/components/icons";
import { TrendingUp as LucideTrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DashboardMetricsProps {
  metrics: {
    bookings: number;
    bookingsYesterday: number;
    arrivals: number;
    arrivalsCheckedIn: number;
    departures: number;
    departuresNotYetLeft: number;
    inHouseGuests: number;
    occupiedRooms: number;
    totalRooms: number;
    cancellations: number;
    canceledBookings: number;
  };
}

export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  const { t } = useTranslation('pages/dashboard/content');

  const bookingsComparison = metrics.bookingsYesterday > 0 
    ? Math.round(((metrics.bookings - metrics.bookingsYesterday) / metrics.bookingsYesterday) * 100)
    : (metrics.bookings > 0 ? 100 : 0);

  // Map border colors to text colors
  const colorMap: { [key: string]: string } = {
    'border-blue-500': 'text-blue-600',
    'border-[#003166]': 'text-blue-700',
    'border-indigo-500': 'text-indigo-600',
    'border-emerald-500': 'text-emerald-600',
    'border-cyan-500': 'text-cyan-600',
    'border-rose-500': 'text-rose-600',
  };

  const metricCards = [
    { 
      title: t('metric_cards.bookings.title'), 
      value: metrics.bookings, 
      icon: Icons.CalendarCheck, 
      colorClass: 'border-blue-500', 
      dataAiHint: "calendar checkmark",
      subtext: `vs yesterday ${bookingsComparison >= 0 ? '+' : ''}${bookingsComparison}%`
    },
    { 
      title: t('metric_cards.arrivals.title'), 
      value: metrics.arrivals, 
      icon: Icons.LogIn, 
      colorClass: 'border-[#003166]', 
      dataAiHint: "door enter",
      subtext: `${metrics.arrivalsCheckedIn} already checked-in`
    },
    { 
      title: t('metric_cards.departures.title'), 
      value: metrics.departures, 
      icon: Icons.LogOut, 
      colorClass: 'border-indigo-500', 
      dataAiHint: "door exit",
      subtext: `${metrics.departuresNotYetLeft} not yet left`
    },
    { 
      title: t('metric_cards.in_house_guests.title'), 
      value: metrics.inHouseGuests, 
      icon: Icons.Users, 
      colorClass: 'border-emerald-500', 
      dataAiHint: "group people",
      subtext: 'Total Guests'
    },
    { 
      title: t('metric_cards.occupied_rooms.title'), 
      value: Math.round(metrics.occupiedRooms), 
      icon: Icons.BedDouble, 
      colorClass: 'border-cyan-500', 
      dataAiHint: "hotel bed occupied",
      subtext: `${Math.round(metrics.occupiedRooms)}/${metrics.totalRooms} Rooms`
    },
    { 
      title: t('metric_cards.cancellations.title'), 
      value: metrics.cancellations, 
      icon: Icons.XCircle, 
      colorClass: 'border-rose-500', 
      dataAiHint: "cancel cross",
      subtext: `${metrics.canceledBookings} Canceled bookings`
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metricCards.map((metric) => {
        const IconComponent = (metric.icon as any) || Icons.TrendingUp;
        const textColor = colorMap[(metric as any).colorClass] || 'text-slate-400';
        return (
          <div key={metric.title} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${(metric as any).colorClass || 'border-slate-200'} transition-transform hover:-translate-y-1`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{metric.title}</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{metric.value}</h3>
              </div>
              <div className={`p-2 rounded-lg bg-slate-50`}>
                <IconComponent size={18} className="text-slate-400" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {(metric as any).trend ? (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center"><LucideTrendingUp size={10} className="mr-1" /> {(metric as any).trend}</span>
              ) : (
                <span className={`text-[10px] font-medium ${textColor}`}>{(metric as any).subtext}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
