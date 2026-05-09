"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface BlockBarProps {
  roomId: string;
  roomName: string;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  reason_details?: string | null;
  notes?: string | null;
  onBlockClick?: () => void;
  style?: React.CSSProperties;
}

export default function BlockBar({ roomId, roomName, startDate, endDate, reason, reason_details, notes, onBlockClick, style }: BlockBarProps) {
  const isMultiDay = startDate.getTime() !== endDate.getTime();
  const dateRange = isMultiDay 
    ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const reasonEmoji = {
    'maintenance': '🔧',
    'owner_stay': '👤',
    'stop_sell': '🛑',
    'out_of_service': '⚠️',
    'other': '❓',
  }[reason || 'stop_sell'] || '🛑';

  const reasonLabel = {
    'maintenance': 'Maintenance',
    'owner_stay': 'Owner Stay',
    'stop_sell': 'Stop Sell',
    'out_of_service': 'Out of Service',
    'other': 'Other',
  }[reason || 'stop_sell'] || 'Blocked';

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute rounded-md p-2 text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity overflow-hidden shadow-md pointer-events-auto",
              "bg-red-600"
            )}
            style={style}
            onClick={onBlockClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onBlockClick?.()}
          >
            <p className="truncate font-semibold">{reasonEmoji} {reasonLabel}</p>
            <p className="text-xs opacity-80 truncate">{dateRange}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{reasonEmoji} {reasonLabel} Block</p>
            <p className="text-xs">Room: {roomName}</p>
            <p className="text-xs">Dates: {dateRange}</p>
            {reason === 'other' && reason_details && (
              <p className="text-xs text-slate-300 mt-1 pt-1 border-t border-slate-600">Custom: {reason_details}</p>
            )}
            {notes && (
              <p className="text-xs text-slate-300 mt-1 pt-1 border-t border-slate-600">Note: {notes}</p>
            )}
            <p className="text-xs text-orange-300 flex items-center gap-1 mt-2">
              <Trash2 className="w-3 h-3" />
              Click to manage
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
