"use client";

import React from "react";
import { AlertTriangle, Bell, X } from 'lucide-react';

interface AlertBannerProps {
  type: 'warning' | 'error';
  message: string;
  count: number;
  onDismiss: () => void;
}

export function AlertBanner({ type, message, count, onDismiss }: AlertBannerProps) {
  return (
    <div className={`flex items-center justify-between p-3 px-4 rounded-lg border text-xs font-medium ${
      type === 'warning' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'
    }`}>
      <div className="flex items-center gap-3">
        <Bell className="w-4 h-4" />
        {message}
      </div>
      <div className="flex items-center gap-3">
        <button className="underline font-bold">Details</button>
        <button onClick={onDismiss} className="opacity-50 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
