"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LucidePieChart } from 'lucide-react';

interface ChannelMixCardProps {
  direct: number;
  ota: number;
  walkIn: number;
}

export function ChannelMixCard({
  direct,
  ota,
  walkIn,
}: ChannelMixCardProps) {
  const { t } = useTranslation('pages/dashboard/content');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <LucidePieChart size={18} style={{ color: '#003166' }} />
        <h2 className="text-sm font-bold text-slate-800">Channel Mix</h2>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="relative w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#eee" strokeWidth="4"></circle>
            <circle cx="18" cy="18" r="16" fill="none" stroke="#003166" strokeWidth="4" strokeDasharray={`${direct} 100`}></circle>
            <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${ota} 100`} strokeDashoffset={`-${direct}`}></circle>
            <circle cx="18" cy="18" r="16" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${walkIn} 100`} strokeDashoffset={`-${direct + ota}`}></circle>
          </svg>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#003166]"></div>
            <span className="text-[10px] font-bold">Direct ({direct}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
            <span className="text-[10px] font-bold">OTA ({ota}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
            <span className="text-[10px] font-bold">Walk-in ({walkIn}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
