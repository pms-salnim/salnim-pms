
"use client";

import React from 'react';
import { format, addDays } from 'date-fns';
import RoomRow from './room-row';
import type { Room as CalendarRoomType } from './types';
import type { Reservation } from '@/types/reservation';
import type { RoomType } from '@/types/roomType';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { type AvailabilitySetting } from '@/types/availabilityOverride'; // Import AvailabilitySetting

interface CalendarGridProps {
  currentDate: Date;
  viewMode: 7 | 14 | 30;
  roomTypes: RoomType[];
  rooms: CalendarRoomType[];
  reservations: Reservation[];
  availabilitySettings: AvailabilitySetting[]; // Add this prop
  onReservationClick: (reservation: Reservation) => void;
}

const DAY_WIDTH_PX = 80; 
const ROOM_NAME_COL_WIDTH_PX = 180;

export default function CalendarGrid({
  currentDate,
  viewMode,
  roomTypes,
  rooms,
  reservations,
  availabilitySettings, // Destructure the new prop
  onReservationClick,
}: CalendarGridProps) {
  const startDate = currentDate;
  const dates = Array.from({ length: viewMode }, (_, i) => addDays(startDate, i));

  return (
    <ScrollArea className="w-full h-full border rounded-lg shadow-sm bg-card">
      <div 
        className="relative grid" 
        style={{ 
          gridTemplateColumns: `${ROOM_NAME_COL_WIDTH_PX}px repeat(${viewMode}, minmax(${DAY_WIDTH_PX}px, 1fr))`,
          minWidth: `${DAY_WIDTH_PX * viewMode + ROOM_NAME_COL_WIDTH_PX}px` 
        }}
      >
        {/* Header: Unit & Dates (This is one grid row) */}
        <div className="p-2 font-semibold text-sm border-r border-b sticky left-0 top-0 bg-muted z-30 flex items-center">Rooms</div>
        {dates.map((date, index) => (
          <div key={index} className="p-2 text-center border-r border-b last:border-r-0 sticky top-0 bg-muted z-20">
            <div className="text-xs font-medium text-muted-foreground">{format(date, 'EEE')}</div>
            <div className="text-lg font-semibold text-foreground">{format(date, 'd')}</div>
          </div>
        ))}

        {/* Body: Room Types and Rooms */}
        {roomTypes.length === 0 && (
          <div 
            className="text-center p-10 text-muted-foreground"
            style={{ gridColumn: `1 / span ${viewMode + 1}` }} 
          >
            No room types available. Please add room types in the 'Rooms' section.
          </div>
        )}

        {roomTypes.map((roomType) => {
          const roomsInThisType = rooms
            .filter(room => room.roomTypeId === roomType.id)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

          return (
            <React.Fragment key={roomType.id}>
              {/* Room Type Header Row (This is another complete grid row) */}
              <div 
                className="p-2 border-b border-r font-semibold text-md text-primary sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-20 flex items-center"
                style={{ height: '3rem' }} 
              >
                {roomType.name}
              </div>
              <div 
                className="border-b bg-slate-50 dark:bg-slate-800/50" 
                style={{ gridColumn: `2 / span ${viewMode}`, height: '3rem' }} 
              ></div>
              
              {/* Room Rows for this type */}
              {roomsInThisType.length > 0 ? roomsInThisType.map((room) => {
                const roomReservations = reservations.filter(res => res.rooms.some(r => r.roomId === room.id));
                return (
                  <RoomRow
                    key={room.id}
                    room={room}
                    dates={dates}
                    reservations={roomReservations}
                    availabilitySettings={availabilitySettings} // Pass down the settings
                    onReservationClick={onReservationClick}
                    dayWidth={DAY_WIDTH_PX}
                    roomNameColWidth={ROOM_NAME_COL_WIDTH_PX} // Pass this for consistent sizing
                  />
                );
              }) : (
                 <>
                    <div 
                      className="p-2 border-b border-r text-sm text-muted-foreground italic sticky left-0 bg-card z-10 pl-6 flex items-center"
                      style={{ height: '3.5rem' }}
                    >
                      No rooms assigned
                    </div>
                    <div 
                      className="border-b"
                      style={{ gridColumn: `2 / span ${viewMode}`, height: '3.5rem' }}
                    ></div>
                 </>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}
