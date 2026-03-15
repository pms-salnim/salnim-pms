"use client";

import React from "react";
import { MoreHorizontal, ArrowRight, DollarSign, FileText, RotateCcw, Plus } from 'lucide-react';

interface ActivityItem {
  id: number;
  type: 'payment' | 'invoice' | 'refund' | 'adjustment';
  title: string;
  ref: string;
  amount: number;
  time: string;
  icon: React.ReactNode;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  onViewAll?: () => void;
}

export function ActivityFeed({ items, onViewAll }: ActivityFeedProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-50 flex justify-between items-center">
        <h3 className="text-sm font-bold">Recent Activity</h3>
        <button className="p-1.5 hover:bg-slate-50 rounded-lg">
          <MoreHorizontal className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map((act) => (
          <div
            key={act.id}
            className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                act.type === 'payment' ? 'bg-emerald-50 text-emerald-600' :
                act.type === 'refund' ? 'bg-rose-50 text-rose-600' :
                act.type === 'invoice' ? 'bg-blue-50 text-blue-600' :
                'bg-slate-50 text-slate-600'
              }`}>
                {act.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{act.title}</p>
                <p className="text-xs text-slate-400">{act.ref} • {act.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-bold ${
                act.amount < 0 ? 'text-rose-600' : 'text-slate-900'
              }`}>
                {act.amount < 0 ? '-' : ''}${Math.abs(act.amount).toLocaleString()}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onViewAll}
        className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 border-t border-slate-50 bg-slate-50/20"
      >
        VIEW ALL ACTIVITY
      </button>
    </div>
  );
}
