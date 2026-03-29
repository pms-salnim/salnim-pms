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

  const channels = [
    { name: 'Direct', value: direct, color: '#003166' },
    { name: 'OTA', value: ota, color: '#3b82f6' },
    { name: 'Walk-in', value: walkIn, color: '#fbbf24' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        
        <h2 className="text-sm font-bold text-slate-800">Booking Source</h2>
      </div>
      
      <div className="space-y-2.5">
        {channels.map((channel) => (
          <div key={channel.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: channel.color }}
                ></div>
                <span className="text-[9px] font-semibold text-slate-700">{channel.name}</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{channel.value}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${channel.value}%`,
                  backgroundColor: channel.color,
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
