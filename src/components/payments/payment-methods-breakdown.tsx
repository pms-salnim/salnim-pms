"use client";

import React from "react";
import { CreditCard } from 'lucide-react';

interface PaymentMethod {
  method: string;
  amount: number;
  count?: number;
}

interface PaymentMethodsBreakdownProps {
  methods: PaymentMethod[];
  total: number;
}

const METHOD_COLORS: Record<string, string> = {
  'Credit Card': '#3b82f6',
  'Bank Transfer': '#8b5cf6',
  'Cash': '#10b981',
  'Online': '#f59e0b',
  'Online Gateway': '#f59e0b',
  'Stripe': '#635bff',
};

export function PaymentMethodsBreakdown({ methods, total }: PaymentMethodsBreakdownProps) {
  if (!methods || methods.length === 0 || !total) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold mb-6">Payment Methods Breakdown</h3>
        <p className="text-xs text-slate-500">No payment data available</p>
      </div>
    );
  }

  const topMethod = methods.reduce((a, b) => (a.amount || 0) > (b.amount || 0) ? a : b);
  const topMethodPercentage = topMethod ? Math.round(((topMethod.amount || 0) / total) * 100) : 0;
  const getColor = (methodName: string) => METHOD_COLORS[methodName] || '#64748b';

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-bold mb-6">Payment Methods Breakdown</h3>
      <div className="space-y-5">
        {methods.map((method) => {
          const amount = method.amount || 0;
          const percentage = total > 0 ? (amount / total) * 100 : 0;
          const color = getColor(method.method);
          
          return (
            <div key={method.method} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-600">{method.method}</span>
                <span className="font-bold">${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-50">
        {topMethod && (
          <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-blue-400 uppercase">Top Channel</p>
              <p className="text-sm font-bold text-blue-700">{topMethod.method} ({topMethodPercentage}%)</p>
            </div>
            <CreditCard className="w-6 h-6 text-blue-300" />
          </div>
        )}
      </div>
    </div>
  );
}
