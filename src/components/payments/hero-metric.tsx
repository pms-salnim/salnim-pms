"use client";

import React from "react";
import { DollarSign, TrendingUp, Clock, AlertTriangle, RotateCcw, Eye } from 'lucide-react';

interface HeroMetricProps {
  title: string;
  value: string;
  trend?: string;
  status?: 'paid' | 'pending' | 'overdue' | 'refund';
  isNet?: boolean;
  isHighlighted?: boolean;
}

export function HeroMetric({ title, value, trend, status, isNet, isHighlighted }: HeroMetricProps) {
  const getBorderColor = () => {
    if (isHighlighted) return 'border-blue-500';
    if (status === 'paid') return 'border-emerald-500';
    if (status === 'pending') return 'border-amber-500';
    if (status === 'overdue') return 'border-rose-500';
    if (status === 'refund') return 'border-slate-400';
    return 'border-slate-200';
  };

  const getIconColor = () => {
    if (status === 'paid') return 'text-emerald-600';
    if (status === 'pending') return 'text-amber-600';
    if (status === 'overdue') return 'text-rose-600';
    if (status === 'refund') return 'text-slate-500';
    if (isNet) return 'text-blue-600';
    return 'text-slate-400';
  };

  const getIcon = () => {
    if (status === 'paid' || isHighlighted) return <DollarSign size={18} />;
    if (status === 'pending') return <Clock size={18} />;
    if (status === 'overdue') return <AlertTriangle size={18} />;
    if (status === 'refund') return <RotateCcw size={18} />;
    if (isNet) return <Eye size={18} />;
    return <DollarSign size={18} />;
  };

  const getTrendColor = () => {
    if (status === 'paid' || isHighlighted) return 'text-emerald-600';
    if (status === 'pending') return 'text-amber-600';
    if (status === 'overdue') return 'text-rose-600';
    return 'text-slate-500';
  };

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${getBorderColor()} transition-transform hover:-translate-y-1`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg bg-slate-50`}>
          <div className={getIconColor()}>
            {getIcon()}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        {trend && (
          <span className={`text-[10px] font-bold ${getTrendColor()} flex items-center`}>
            <TrendingUp size={10} className="mr-1" /> {trend}
          </span>
        )}
      </div>
    </div>
  );
}
