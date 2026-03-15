
"use client";

import React from 'react';
import type { Reservation } from './types';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface ReservationBarProps {
  reservation: Reservation;
  onClick: () => void;
  style?: React.CSSProperties;
}

export default function ReservationBar({ reservation, onClick, style }: ReservationBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute rounded-md p-2 text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity overflow-hidden shadow-md pointer-events-auto",
              reservation.color || 'bg-primary'
            )}
            style={style}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
          >
            <p className="truncate">{reservation.guestName}</p>
            <p className="text-xs opacity-80 truncate">{reservation.status}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground">
          <p className="font-semibold">{reservation.guestName}</p>
          <p>Room: {reservation.roomId}</p>
          <p>Dates: {reservation.startDate.toLocaleDateString()} - {reservation.endDate.toLocaleDateString()}</p>
          <p>Status: {reservation.status}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
