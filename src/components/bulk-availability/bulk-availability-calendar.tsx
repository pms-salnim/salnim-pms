'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, HelpCircle, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface Room {
  id: string;
  name: string;
}

interface RoomsObject {
  [roomTypeId: string]: Room[];
}

interface RoomType {
  id: string;
  name: string;
}

interface AvailabilityOption {
  id: string;
  label: string;
  color: string;
}

interface AvailabilityData {
  room_id: string;
  date: string;
  end_date: string | null;
  status: string;
}

interface BulkAvailabilityCalendarProps {
  dates: Date[];
  roomTypes: RoomType[];
  rooms: RoomsObject;
  selectedAvailability: string[];
  availabilityOptions: AvailabilityOption[];
  selectedRoomType: string;
  propertyId?: string;
  selectedCells?: Map<string, Set<number>>;
  expandedRoomTypes?: Set<string>;
  onToggleRoomType?: (roomTypeId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onCellClick?: (roomId: string, dateIndex: number, event: React.MouseEvent) => void;
  onCellDragStart?: (roomId: string, dateIndex: number) => void;
  onCellDragOver?: (roomId: string, dateIndex: number) => void;
  onCellDragEnd?: () => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onGoToToday?: () => void;
  onGoToNextWeek?: () => void;
  onGoToNextMonth?: () => void;
  onCustomDateChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  startDate?: Date;
  selectedDateRanges?: string[];
  refreshTrigger?: number;
}

const formatDateHeader = (date: Date): string => {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  return `${dayName} ${dayNum}`;
};

// Status to color mapping for database statuses
const STATUS_COLOR_MAP: Record<string, string> = {
  'available': '#10b981',        // green
  'not_available': '#ef4444',     // red (stop sell)
  'closed_to_arrival': '#f97316', // orange
  'closed_to_departure': '#8b5cf6', // purple
};

export function BulkAvailabilityCalendar({
  dates,
  roomTypes,
  rooms,
  selectedAvailability,
  availabilityOptions,
  selectedRoomType,
  propertyId,
  selectedCells = new Map(),
  expandedRoomTypes = new Set(),
  onToggleRoomType,
  onExpandAll,
  onCollapseAll,
  onCellClick,
  onCellDragStart,
  onCellDragOver,
  onCellDragEnd,
  onPrevDay,
  onNextDay,
  onGoToToday,
  onGoToNextWeek,
  onGoToNextMonth,
  onCustomDateChange,
  startDate,
  selectedDateRanges = [],
  refreshTrigger = 0,
}: BulkAvailabilityCalendarProps) {
  const [availabilityDataMap, setAvailabilityDataMap] = useState<Map<string, AvailabilityData>>(new Map());

  // Fetch availability data from Supabase
  useEffect(() => {
    const fetchAvailabilityData = async () => {
      if (!propertyId || dates.length === 0) {
        setAvailabilityDataMap(new Map());
        return;
      }

      try {
        // Get date range
        const minDate = dates[0].toISOString().split('T')[0];
        const maxDate = dates[dates.length - 1].toISOString().split('T')[0];

        // Get all room IDs
        const allRoomIds = Object.values(rooms).flat().map(r => r.id);
        if (allRoomIds.length === 0) {
          setAvailabilityDataMap(new Map());
          return;
        }

        // Query availability data from API
        const params = new URLSearchParams({
          propertyId,
          minDate,
          maxDate,
          roomIds: allRoomIds.join(','),
        });

        const response = await fetch(`/api/property-settings/rates-availability/calendar?${params}`);
        if (!response.ok) throw new Error('Failed to fetch availability');

        const data: AvailabilityData[] = await response.json();

        // Create a map for quick lookup: "roomId-date" -> AvailabilityData
        const dataMap = new Map<string, AvailabilityData>();
        data.forEach(item => {
          // Add entry for the start date
          dataMap.set(`${item.room_id}-${item.date}`, item);

          // If this is a range (has end_date), add entries for all dates in the range
          if (item.end_date && item.end_date !== item.date) {
            const startDate = new Date(item.date);
            const endDate = new Date(item.end_date);
            const currentDate = new Date(startDate);

            while (currentDate.getTime() <= endDate.getTime()) {
              const dateStr = currentDate.toISOString().split('T')[0];
              if (dateStr !== item.date) {
                // Create a copy of the item for intermediate dates
                dataMap.set(`${item.room_id}-${dateStr}`, {
                  ...item,
                  date: dateStr,
                });
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });

        setAvailabilityDataMap(dataMap);
      } catch (error) {
        console.error('Error fetching availability data:', error);
        setAvailabilityDataMap(new Map());
      }
    };

    fetchAvailabilityData();
  }, [propertyId, dates, rooms, refreshTrigger]);

  // Get the color for the selected availability
  const selectedColor = useMemo(() => {
    if (selectedAvailability.length === 0) return null;
    const option = availabilityOptions.find(o => o.id === selectedAvailability[0]);
    return option?.color || null;
  }, [selectedAvailability, availabilityOptions]);

  // Determine which room types to show
  const visibleRoomTypes = useMemo(() => {
    if (selectedRoomType === 'all') {
      return roomTypes;
    }
    return roomTypes.filter(rt => rt.id === selectedRoomType);
  }, [selectedRoomType, roomTypes]);

  // Helper function to get the color for a room-date cell based on Supabase data
  const getCellColor = (roomId: string, dateIndex: number): string | null => {
    const dateStr = dates[dateIndex].toISOString().split('T')[0];
    const key = `${roomId}-${dateStr}`;
    const availData = availabilityDataMap.get(key);

    if (availData) {
      // Return the color for this status
      return STATUS_COLOR_MAP[availData.status] || null;
    }

    // No data available for this room-date combination
    return null;
  };

  // Calculate selected cell count
  const selectedCount = useMemo(() => {
    return Array.from(selectedCells.values()).reduce((sum, set) => sum + set.size, 0);
  }, [selectedCells]);

  // Calculate collapsed room types count
  const collapsedCount = useMemo(() => {
    return visibleRoomTypes.filter(rt => !expandedRoomTypes.has(rt.id)).length;
  }, [visibleRoomTypes, expandedRoomTypes]);

  return (
      <div className="flex flex-col h-full bg-white">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">

        {/* Legend - Inline */}
        <div className="mt-2 mb-2 flex flex-wrap gap-2 items-center">
          {availabilityOptions.map((option) => {
            const descriptions: Record<string, string> = {
              available: 'Room is available for booking',
              stop_sell: 'Room is blocked from all bookings',
              close_arrival: 'Room cannot be booked for arrival on this day',
              close_departure: 'Room cannot be booked for departure on this day',
              min_stay: 'Minimum stay requirement applies',
              max_stay: 'Maximum stay restriction applies',
            };
            const desc = descriptions[option.id] || 'Availability status';
            
            return (
              <div key={option.id} className="flex items-center gap-1 group relative">
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: option.color, opacity: 0.3 }}
                />
                <span className="text-xs text-slate-600">{option.label}</span>
                <HelpCircle className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                
                {/* Tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2.5 py-1.5 max-w-sm z-[100] break-words text-center">
                  {desc}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-3 border-transparent border-b-slate-900" />
                </div>
              </div>
            );
          })}
        </div>

        {selectedAvailability.length > 0 && (
          <p className="text-xs text-slate-500">Click • Shift+Click for range • Cmd/Ctrl+Click multi</p>
        )}

        {visibleRoomTypes.length > 1 && (
          <div className="mt-3 flex gap-2">
            {collapsedCount < visibleRoomTypes.length && (
              <button
                onClick={onCollapseAll}
                className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
              >
                Collapse All
              </button>
            )}
            {collapsedCount > 0 && (
              <button
                onClick={onExpandAll}
                className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
              >
                Expand All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Date Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
                          <button
                              onClick={onPrevDay}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="Previous Day"
                          >
                              <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                              onClick={onNextDay}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="Next Day"
                          >
                              <ChevronRight className="w-4 h-4" />
                          </button>
                      </div>

                      <div className="flex items-center gap-1">
                          <button
                              onClick={onGoToToday}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                              Today
                          </button>
                          <button
                              onClick={onGoToNextWeek}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                              Next Week
                          </button>
                          <button
                              onClick={onGoToNextMonth}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                              Next Month
                          </button>
                      </div>
                  </div>

                  <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Start Date:</span>
                          <input
                              type="date"
                              value={startDate ? startDate.toISOString().split('T')[0] : ''}
                              onChange={onCustomDateChange}
                              className="bg-transparent border-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-0 cursor-pointer p-0"
                          />
                      </div>
                  </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Date Headers */}
          <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
            <div className="w-32 px-4 py-3 bg-slate-50 border-r border-slate-200 font-bold text-sm text-slate-900 flex-shrink-0 sticky left-0 z-20">
              Room Type
            </div>
            {dates.map((date, idx) => (
              <div
                key={idx}
                className="w-24 px-2 py-3 text-center border-r border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 flex-shrink-0"
              >
                {formatDateHeader(date)}
              </div>
            ))}
          </div>

          {/* Room Type Sections */}
          {visibleRoomTypes.map((roomType) => {
            const roomsInType = rooms[roomType.id] || [];
            return (
              <div key={roomType.id}>
                {/* Room Type Header Row */}
                <div className="flex border-b border-slate-200 bg-slate-100 hover:bg-slate-150 group cursor-pointer" onClick={() => onToggleRoomType?.(roomType.id)}>
                  <div className="w-32 px-4 py-3 bg-slate-100 border-r border-slate-200 font-bold text-sm text-slate-900 flex-shrink-0 sticky left-0 z-10 flex items-center gap-2">
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedRoomTypes.has(roomType.id) ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                    {roomType.name}
                  </div>
                  {dates.map((date, idx) => (
                    <div
                      key={idx}
                      className="w-24 px-2 py-3 border-r border-slate-200 text-center text-xs text-slate-600 flex-shrink-0"
                    >
                      {roomsInType.length} room{roomsInType.length !== 1 ? 's' : ''}
                    </div>
                  ))}
                </div>

                {/* Individual Room Rows */}
                {expandedRoomTypes.has(roomType.id) && roomsInType.map((room) => (
                  <div key={room.id} className="flex border-b border-slate-100 hover:bg-slate-50 transition">
                    <div className="w-32 px-4 py-3 bg-white border-r border-slate-200 text-sm text-slate-700 font-medium flex-shrink-0 sticky left-0 z-10">
                      {room.name}
                    </div>
                    {dates.map((date, dateIdx) => {
                      const roomCells = selectedCells.get(room.id);
                      const isSelected = roomCells?.has(dateIdx) || false;
                      const cellColor = getCellColor(room.id, dateIdx);
                      
                      return (
                        <div
                          key={dateIdx}
                          className="w-24 px-2 py-3 border-r border-slate-200 flex-shrink-0 flex items-center justify-center"
                          onMouseDown={() => onCellDragStart?.(room.id, dateIdx)}
                          onMouseEnter={() => onCellDragOver?.(room.id, dateIdx)}
                          onMouseUp={() => onCellDragEnd?.()}
                        >
                          {/* Show actual status color from Supabase if available */}
                          {cellColor ? (
                            <div
                              className={`w-full h-10 rounded transition-all cursor-pointer border-2 flex items-center justify-center font-bold text-xs ${
                                isSelected
                                  ? 'border-slate-900 ring-2 ring-slate-300'
                                  : 'border-transparent opacity-70 hover:opacity-90'
                              }`}
                              style={{
                                backgroundColor: cellColor,
                              }}
                              onClick={(e) => onCellClick?.(room.id, dateIdx, e)}
                              title={`${room.name} - ${formatDateHeader(date)}\nStatus: Set • Click to select for change`}
                            >
                              {isSelected && '✓'}
                            </div>
                          ) : selectedColor && selectedAvailability.length > 0 ? (
                            /* Show selection mode if user has selected an availability option and no existing data */
                            <div
                              className={`w-full h-10 rounded transition-all cursor-pointer border-2 flex items-center justify-center font-bold text-xs ${
                                isSelected
                                  ? 'border-slate-900 bg-opacity-40'
                                  : 'border-transparent opacity-20 hover:opacity-30'
                              }`}
                              style={{
                                backgroundColor: selectedColor,
                              }}
                              onClick={(e) => onCellClick?.(room.id, dateIdx, e)}
                              title={`${room.name} - ${formatDateHeader(date)}\nNo availability set • Click to select • Shift+Click for range • Cmd/Ctrl+Click to multi-select`}
                            >
                              {isSelected && '✓'}
                            </div>
                          ) : (
                            /* Show empty state when no data and no selection mode */
                            <div 
                              className="w-full h-10 rounded bg-slate-100 transition-colors border-2 border-transparent"
                              title="No availability data set"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Empty State */}
          {visibleRoomTypes.length === 0 && (
            <div className="flex items-center justify-center h-48 text-slate-500">
              <p className="text-sm">No room data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
