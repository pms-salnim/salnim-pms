'use client';

import React, { useState } from 'react';
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

interface RestrictionsSettingsFormProps {
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
  closeToArrival: boolean;
  onCloseToArrivalChange: (checked: boolean) => void;
  closeToDeparture: boolean;
  onCloseToDepartureChange: (checked: boolean) => void;
  minStay: number | null;
  onMinStayChange: (value: number | null) => void;
  maxStay: number | null;
  onMaxStayChange: (value: number | null) => void;
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

export function RestrictionsSettingsForm({
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
  closeToArrival,
  onCloseToArrivalChange,
  closeToDeparture,
  onCloseToDepartureChange,
  minStay,
  onMinStayChange,
  maxStay,
  onMaxStayChange,
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
}: RestrictionsSettingsFormProps) {
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

  // Validation helpers
  const isDateRangeValid = !dateRange.start || !dateRange.end || dateRange.start <= dateRange.end;
  const dateError = dateRange.start && dateRange.end && dateRange.start > dateRange.end 
    ? 'End date must be after start date' 
    : null;
  const isStayRangeValid = !minStay || !maxStay || minStay <= maxStay;
  const stayError = minStay && maxStay && minStay > maxStay 
    ? 'Min stay must be less than or equal to max stay' 
    : null;
  const isFormValid = isDateRangeValid && isStayRangeValid;

  return (
    <div className="space-y-5">
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

      {/* Restrictions Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Restrictions</label>
        <div className="space-y-2">
          {/* Close to Arrival */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="close-to-arrival"
              checked={closeToArrival}
              onCheckedChange={(checked) => onCloseToArrivalChange(checked === true)}
            />
            <label htmlFor="close-to-arrival" className="text-xs text-slate-600 cursor-pointer flex-1">
              Close to Arrival
            </label>
          </div>

          {/* Close to Departure */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="close-to-departure"
              checked={closeToDeparture}
              onCheckedChange={(checked) => onCloseToDepartureChange(checked === true)}
            />
            <label htmlFor="close-to-departure" className="text-xs text-slate-600 cursor-pointer flex-1">
              Close to Departure
            </label>
          </div>

          {/* Min & Max Stay */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="min-stay" className="text-xs font-semibold text-slate-900">
                Min Stay
              </label>
              <input
                id="min-stay"
                type="number"
                min="1"
                value={minStay ?? ''}
                onChange={(e) => onMinStayChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Nights"
                className={`px-2 py-1.5 text-xs border rounded bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  stayError ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="max-stay" className="text-xs font-semibold text-slate-900">
                Max Stay
              </label>
              <input
                id="max-stay"
                type="number"
                min="1"
                value={maxStay ?? ''}
                onChange={(e) => onMaxStayChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="Nights"
                className={`px-2 py-1.5 text-xs border rounded bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  stayError ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
            </div>
          </div>
          {stayError && (
            <p className="text-xs text-red-600 font-medium">{stayError}</p>
          )}
        </div>
      </div>

      {/* Room Types Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Room Types</label>
        <p className="text-xs text-slate-500 italic mb-2">
          ℹ️ Restrictions will apply to all rooms in the selected room types
        </p>
        <div className="space-y-1.5 border border-slate-200 rounded-lg overflow-hidden">
          {roomTypes.map((roomType) => {
            const roomsInType = rooms[roomType.id] || [];
            const isSelected = roomsInType.length > 0 && roomsInType.every(r => selectedRooms.includes(r.id));

            return (
              <div key={roomType.id} className="px-3 py-2.5 flex items-center gap-2 border-b last:border-b-0 hover:bg-slate-50 transition">
                <Checkbox
                  id={`roomtype-${roomType.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Select all rooms in this room type
                      onSelectedRoomsChange([...selectedRooms, ...roomsInType.filter(r => !selectedRooms.includes(r.id)).map(r => r.id)]);
                    } else {
                      // Deselect all rooms in this room type
                      onSelectedRoomsChange(selectedRooms.filter(r => !roomsInType.map(rt => rt.id).includes(r)));
                    }
                  }}
                />
                <div className="flex-1">
                  <label htmlFor={`roomtype-${roomType.id}`} className="text-xs font-semibold text-slate-900 cursor-pointer">
                    {roomType.name}
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {roomsInType.length} room{roomsInType.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button
          onClick={onReset}
          variant="outline"
          className="flex-1 h-9 text-sm font-semibold"
        >
          Reset
        </Button>
        <Button
          onClick={onUpdate}
          disabled={!isFormValid || selectedRooms.length === 0}
          className="flex-1 h-9 text-sm font-semibold"
        >
          Update Restrictions
        </Button>
      </div>
    </div>
  );
}