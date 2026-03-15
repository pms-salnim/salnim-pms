"use client";

import React from "react";
import { Icons } from "@/components/icons";

interface PaymentMetricsProps {
  metrics: {
    totalCollected: number;
    pendingAmount: number;
    overdueAmount: number;
    refundsIssued: number;
    collectionRate: number;
  };
  currencySymbol: string;
}

export function PaymentMetrics({ metrics, currencySymbol }: PaymentMetricsProps) {
  // Map border colors to text colors
  const colorMap: { [key: string]: string } = {
    'border-green-500': 'text-green-600',
    'border-blue-500': 'text-blue-600',
    'border-red-500': 'text-red-600',
    'border-orange-500': 'text-orange-600',
    'border-purple-500': 'text-purple-600',
  };

  const metricCards = [
    {
      title: "Total Collected",
      value: `${currencySymbol}${metrics.totalCollected.toFixed(0)}`,
      icon: Icons.CheckCircle,
      colorClass: 'border-green-500',
      subtext: 'This period',
    },
    {
      title: "Pending Amount",
      value: `${currencySymbol}${metrics.pendingAmount.toFixed(0)}`,
      icon: Icons.CreditCard,
      colorClass: 'border-blue-500',
      subtext: 'Awaiting payment',
    },
    {
      title: "Overdue Amount",
      value: `${currencySymbol}${metrics.overdueAmount.toFixed(0)}`,
      icon: Icons.AlertCircle,
      colorClass: 'border-red-500',
      subtext: 'Past due date',
    },
    {
      title: "Refunds Issued",
      value: `${currencySymbol}${metrics.refundsIssued.toFixed(0)}`,
      icon: Icons.Undo2,
      colorClass: 'border-orange-500',
      subtext: 'This period',
    },
    {
      title: "Collection Rate",
      value: `${metrics.collectionRate.toFixed(1)}%`,
      icon: Icons.TrendingUp,
      colorClass: 'border-purple-500',
      subtext: 'Paid / Total invoiced',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
              <span className={`text-[10px] font-medium ${textColor}`}>{(metric as any).subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
