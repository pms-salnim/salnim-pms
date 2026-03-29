"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

interface OccupancyDonutProps {
  occupancyPercent: number;
  bookedUnits: number;
  availableUnits: number;
  outOfService: number;
  blockedDates: number;
}

export function OccupancyDonutCard({
  occupancyPercent,
  bookedUnits,
  availableUnits,
  outOfService,
  blockedDates,
}: OccupancyDonutProps) {
  const { t } = useTranslation('pages/dashboard/content');
  
  // SVG donut chart properties
  const size = 120;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (occupancyPercent / 100) * circumference;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
      {/* Donut Chart */}
      <div className="relative w-32 h-32 mb-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#003166"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Center percentage */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-slate-800">{occupancyPercent}%</div>
          <div className="text-[10px] text-slate-400">Occupancy</div>
        </div>
      </div>

      {/* Statistics */}
      <div className="w-full space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">Available</span>
          </div>
          <span className="font-bold text-slate-800">{availableUnits}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-slate-600">Booked</span>
          </div>
          <span className="font-bold text-slate-800">{bookedUnits}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-slate-600">Out of Service</span>
          </div>
          <span className="font-bold text-slate-800">{outOfService}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-slate-600">Blocked Dates</span>
          </div>
          <span className="font-bold text-slate-800">{blockedDates}</span>
        </div>
      </div>
    </div>
  );
}
