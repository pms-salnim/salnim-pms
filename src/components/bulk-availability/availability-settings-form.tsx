'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Room {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
}

interface AvailabilitySettingsFormProps {
  dateRange: { start: Date | null; end: Date | null };
  onDateRangeChange: (range: { start: Date | null; end: Date | null }) => void;
  openEnded: boolean;
  onOpenEndedChange: (openEnded: boolean) => void;
  selectedDays: number[];
  onSelectedDaysChange: (days: number[]) => void;
  selectAllDays: boolean;
  onSelectAllDaysChange: (selectAll: boolean) => void;
  selectedChannels: string[];
  onSelectedChannelsChange: (channels: string[]) => void;
  channels: Array<{ id: string; name: string }>;
  selectedAvailability: string[];
  onSelectedAvailabilityChange: (availability: string[]) => void;
  selectedRoomType: string;
  onSelectedRoomTypeChange: (roomType: string) => void;
  roomTypes: RoomType[];
  rooms: Record<string, Room[]>;
  selectedRooms: string[];
  onSelectedRoomsChange: (rooms: string[]) => void;
  selectAllRooms: boolean;
  onSelectAllRoomsChange: (selectAll: boolean) => void;
  onUpdate: () => void;
  onReset: () => void;
}

const DAYS_OF_WEEK = [
  { id: 0, name: 'Mon' },
  { id: 1, name: 'Tue' },
  { id: 2, name: 'Wed' },
  { id: 3, name: 'Thu' },
  { id: 4, name: 'Fri' },
  { id: 5, name: 'Sat' },
  { id: 6, name: 'Sun' },
];

const AVAILABILITY_OPTIONS = [
  { id: 'stop_sell', label: 'Stop Sell', color: 'bg-red-100 border-red-300' },
];

export function AvailabilitySettingsForm({
  dateRange,
  onDateRangeChange,
  openEnded,
  onOpenEndedChange,
  selectedDays,
  onSelectedDaysChange,
  selectAllDays,
  onSelectAllDaysChange,
  selectedChannels,
  onSelectedChannelsChange,
  channels,
  selectedAvailability,
  onSelectedAvailabilityChange,
  selectedRoomType,
  onSelectedRoomTypeChange,
  roomTypes,
  rooms,
  selectedRooms,
  onSelectedRoomsChange,
  selectAllRooms,
  onSelectAllRoomsChange,
  onUpdate,
  onReset,
}: AvailabilitySettingsFormProps) {
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set());

  const toggleRoomTypeExpanded = (roomTypeId: string) => {
    const newExpanded = new Set(expandedRoomTypes);
    if (newExpanded.has(roomTypeId)) {
      newExpanded.delete(roomTypeId);
    } else {
      newExpanded.add(roomTypeId);
    }
    setExpandedRoomTypes(newExpanded);
  };

  const handleDayToggle = (dayId: number) => {
    const newDays = selectedDays.includes(dayId)
      ? selectedDays.filter(d => d !== dayId)
      : [...selectedDays, dayId];
    onSelectedDaysChange(newDays);
    if (newDays.length !== 7) {
      onSelectAllDaysChange(false);
    }
  };

  const handleSelectAllDays = () => {
    if (selectAllDays) {
      onSelectedDaysChange([]);
      onSelectAllDaysChange(false);
    } else {
      onSelectedDaysChange([0, 1, 2, 3, 4, 5, 6]);
      onSelectAllDaysChange(true);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    const newChannels = selectedChannels.includes(channelId)
      ? selectedChannels.filter(c => c !== channelId)
      : [...selectedChannels, channelId];
    onSelectedChannelsChange(newChannels);
  };

  const handleAvailabilityToggle = (availId: string) => {
    const newAvail = selectedAvailability.includes(availId)
      ? selectedAvailability.filter(a => a !== availId)
      : [...selectedAvailability, availId];
    onSelectedAvailabilityChange(newAvail);
  };

  const handleRoomToggle = (roomId: string) => {
    const newRooms = selectedRooms.includes(roomId)
      ? selectedRooms.filter(r => r !== roomId)
      : [...selectedRooms, roomId];
    onSelectedRoomsChange(newRooms);
  };

  // Validation helpers
  const isDateRangeValid = !dateRange.start || !dateRange.end || dateRange.start <= dateRange.end;
  const dateError = dateRange.start && dateRange.end && dateRange.start > dateRange.end 
    ? 'End date must be after start date' 
    : null;

  return (
    <div className="space-y-5">
      {/* Default Behavior Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-900">📌 Default Availability</p>
        <p className="text-xs text-blue-800 leading-relaxed">
          Units are <span className="font-semibold">AVAILABLE by default</span>. 
          Use restrictions below (Stop Sell, etc.) only when you need to block availability.
        </p>
      </div>

      {/* Date Range Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Date Range</label>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`h-8 text-xs flex-1 justify-start ${
                dateError ? 'border-red-300 bg-red-50' : ''
              }`}>
                {dateRange.start ? dateRange.start.toLocaleDateString('en-GB') : 'Start'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.start || undefined}
                onSelect={(date) => onDateRangeChange({ ...dateRange, start: date || null })}
                disabled={(date) => dateRange.end ? date > dateRange.end : false}
              />
            </PopoverContent>
          </Popover>

          <span className="text-slate-400 text-xs font-medium">—</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`h-8 text-xs flex-1 justify-start ${
                dateError ? 'border-red-300 bg-red-50' : ''
              }`}>
                {!openEnded && dateRange.end ? dateRange.end.toLocaleDateString('en-GB') : 'Open'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateRange.end || undefined}
                onSelect={(date) => {
                  onDateRangeChange({ ...dateRange, end: date || null });
                  onOpenEndedChange(false);
                }}
                disabled={(date) => dateRange.start ? date < dateRange.start : false}
              />
            </PopoverContent>
          </Popover>
        </div>
        {dateError && (
          <p className="text-xs text-red-600 font-medium">{dateError}</p>
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="open-ended"
            checked={openEnded}
            onCheckedChange={() => onOpenEndedChange(!openEnded)}
          />
          <label htmlFor="open-ended" className="text-xs text-slate-600 cursor-pointer">
            Open-ended (no end date)
          </label>
        </div>
      </div>

      {/* Days Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-900">Days of Week</label>
          <button
            onClick={handleSelectAllDays}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {selectAllDays ? 'Clear' : 'All'}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.id}
              onClick={() => handleDayToggle(day.id)}
              className={`py-1.5 px-1 text-xs font-semibold rounded border-2 transition ${
                selectedDays.includes(day.id)
                  ? 'bg-blue-100 border-blue-400 text-blue-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {day.name}
            </button>
          ))}
        </div>
      </div>

      {/* Channels Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Channels</label>
        <div className="space-y-1.5">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-2">
              <Checkbox
                id={`channel-${channel.id}`}
                checked={selectedChannels.includes(channel.id)}
                onCheckedChange={() => handleChannelToggle(channel.id)}
              />
              <label htmlFor={`channel-${channel.id}`} className="text-xs text-slate-600 cursor-pointer flex-1">
                {channel.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Availability Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Restrictions</label>
        <div className="space-y-1.5">
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleAvailabilityToggle(option.id)}
              className={`w-full py-2 px-3 rounded border-2 text-xs font-semibold transition text-left ${
                selectedAvailability.includes(option.id)
                  ? `${option.color} border-current`
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Block Reason & Notes (only show if Stop Sell is selected) */}
        {selectedAvailability.includes('stop_sell') && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-3 mt-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Reason for Block</label>
              <select
                id="bulk-reason"
                defaultValue="stop_sell"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
              >
                <option value="maintenance">🔧 Maintenance</option>
                <option value="owner_stay">👤 Owner Stay</option>
                <option value="stop_sell">🛑 Stop Sell</option>
                <option value="out_of_service">⚠️ Out of Service</option>
                <option value="other">❓ Other (specify below)</option>
              </select>
            </div>

            <div>
              <label htmlFor="bulk-notes" className="text-xs font-semibold text-slate-700 block mb-1">
                Notes (optional)
              </label>
              <textarea
                id="bulk-notes"
                placeholder="Add optional notes or custom reason..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs resize-none"
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Room Types & Rooms Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Room Types & Rooms</label>
        <div className="space-y-1.5 border border-slate-200 rounded-lg overflow-hidden">
          {roomTypes.map((roomType) => {
            const roomsInType = rooms[roomType.id] || [];
            const isExpanded = expandedRoomTypes.has(roomType.id);
            const allRoomsSelected = roomsInType.length > 0 && roomsInType.every(r => selectedRooms.includes(r.id));
            const someRoomsSelected = roomsInType.some(r => selectedRooms.includes(r.id));

            return (
              <div key={roomType.id} className="border-b last:border-b-0">
                {/* Room Type Header */}
                <div className="px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                  {someRoomsSelected && !allRoomsSelected ? (
                    <Checkbox
                      checked="indeterminate"
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSelectedRoomsChange([...selectedRooms, ...roomsInType.filter(r => !selectedRooms.includes(r.id)).map(r => r.id)]);
                        } else {
                          onSelectedRoomsChange(selectedRooms.filter(r => !roomsInType.map(rt => rt.id).includes(r)));
                        }
                      }}
                    />
                  ) : (
                    <Checkbox
                      checked={allRoomsSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSelectedRoomsChange([...selectedRooms, ...roomsInType.filter(r => !selectedRooms.includes(r.id)).map(r => r.id)]);
                        } else {
                          onSelectedRoomsChange(selectedRooms.filter(r => !roomsInType.map(rt => rt.id).includes(r)));
                        }
                      }}
                    />
                  )}
                  <button
                    onClick={() => toggleRoomTypeExpanded(roomType.id)}
                    className="flex items-center gap-2 flex-1 hover:bg-slate-100 rounded px-1 py-1 transition"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                    />
                    <span className="text-xs font-semibold text-slate-900 flex-1">{roomType.name}</span>
                  </button>
                  <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {selectedRooms.filter(r => roomsInType.map(rt => rt.id).includes(r)).length}/{roomsInType.length}
                  </span>
                </div>

                {/* Rooms List */}
                {isExpanded && roomsInType.length > 0 && (
                  <div className="bg-slate-50 px-3 py-2 space-y-1.5 border-t border-slate-200">
                    {roomsInType.map((room) => (
                      <div key={room.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`room-${room.id}`}
                          checked={selectedRooms.includes(room.id)}
                          onCheckedChange={() => handleRoomToggle(room.id)}
                        />
                        <label htmlFor={`room-${room.id}`} className="text-xs text-slate-600 cursor-pointer flex-1">
                          {room.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={onUpdate}
          disabled={!isDateRangeValid}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          Update
        </Button>
        <Button
          onClick={onReset}
          variant="outline"
          className="flex-1 text-xs h-8"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
