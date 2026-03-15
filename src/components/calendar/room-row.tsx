
"use client";

import React from 'react';
import ReservationBar from './reservation-bar';
import type { Room, Reservation } from './types';
import { startOfDay, differenceInDays, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AvailabilitySetting } from '@/types/availabilityOverride'; // Import AvailabilitySetting

interface RoomRowProps {
  room: Room;
  dates: Date[];
  reservations: Reservation[];
  availabilitySettings: AvailabilitySetting[]; // Add this prop
  onReservationClick: (reservation: Reservation) => void;
  dayWidth: number;
  roomNameColWidth: number; 
}

export default function RoomRow({ room, dates, reservations, availabilitySettings, onReservationClick, dayWidth, roomNameColWidth }: RoomRowProps) {
  const gridStartDate = startOfDay(dates[0]);

  return (
    <div className="grid contents group"> 
      <div 
        className="p-2 border-b border-r text-sm font-medium text-foreground sticky left-0 bg-card group-hover:bg-muted/50 z-10 flex items-center"
        style={{ height: '4rem' }} 
      >
        <div>{room.name}</div>
      </div>

      <div 
        className="relative border-b group-hover:bg-muted/50" 
        style={{ gridColumn: `2 / span ${dates.length}`, height: '4rem' }} 
      >
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(${dayWidth}px, 1fr))`}}>
          {dates.map((date, dateIndex) => {
            const dayStart = startOfDay(date);

            const isBlocked = availabilitySettings.some(setting => 
              setting.status === 'blocked' &&
              (setting.roomId === room.id || (setting.roomTypeId === room.roomTypeId && !setting.roomId)) &&
              isWithinInterval(dayStart, { start: parseISO(setting.startDate), end: parseISO(setting.endDate) })
            );

            return (
              <div 
                key={dateIndex} 
                className={cn(
                  "border-r last:border-r-0 h-full",
                  isBlocked && "bg-slate-200 dark:bg-slate-700 cursor-not-allowed" // Apply blocked styling
                )}
              />
            );
          })}
        </div>

        {reservations.filter(res => res.status !== 'Canceled' && res.status !== 'No-Show').map((res) => {
          const resStartDate = startOfDay(res.startDate);
          const resEndDate = startOfDay(res.endDate);
          
          if (resEndDate < gridStartDate || resStartDate > dates[dates.length - 1]) return null;

          const effectiveStartForCalc = resStartDate < gridStartDate ? gridStartDate : resStartDate;
          const startOffsetDays = differenceInDays(effectiveStartForCalc, gridStartDate);
          const durationDays = differenceInDays(resEndDate, effectiveStartForCalc);
          
          if (startOffsetDays < 0 || startOffsetDays >= dates.length) return null;

          const leftPosition = startOffsetDays * dayWidth;
          const barWidth = durationDays * dayWidth;
          
          return (
            <ReservationBar
              key={res.id}
              reservation={res}
              onClick={() => onReservationClick(res)}
              style={{
                position: 'absolute',
                left: `${leftPosition}px`,
                width: `${barWidth - 4}px`, 
                top: '0.5rem', 
                height: 'calc(100% - 1rem)', 
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
