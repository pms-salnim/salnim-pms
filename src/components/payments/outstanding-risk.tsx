"use client";

import React from "react";
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface OutstandingItem {
  name: string;
  amount: number;
  age: string;
}

interface OutstandingRiskProps {
  oldestUnpaidDays: number;
  topUnpaid: OutstandingItem[];
  onViewAll?: () => void;
}

export function OutstandingRisk({ oldestUnpaidDays, topUnpaid, onViewAll }: OutstandingRiskProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          Outstanding Risk
        </h3>
        <button
          onClick={onViewAll}
          className="text-xs font-bold text-rose-600 flex items-center gap-1 hover:text-rose-700"
        >
          View All Overdue <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Oldest Unpaid</p>
          <p className="text-xl font-bold">{oldestUnpaidDays} Days</p>
        </div>
        <div className="md:col-span-2 space-y-3">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Top 3 Unpaid</p>
          {topUnpaid.map((item, i) => (
            <div key={i} className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-600">{item.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{item.age}</span>
                <span className="font-bold">${item.amount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
