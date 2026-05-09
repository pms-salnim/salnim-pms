'use client';

import React, { useState } from 'react';
import { ChevronDown, RotateCcw, Check, Search, HelpCircle } from 'lucide-react';
import { dateToString, stringToDate } from '@/lib/date-utils';

interface BulkAvailabilityPanelProps {
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
  selectedRoomType: string;
  onSelectedRoomTypeChange: (roomType: string) => void;
  roomTypes: Array<{ id: string; name: string }>;
  selectedRooms: string[];
  onSelectedRoomsChange: (rooms: string[]) => void;
  selectAllRooms: boolean;
  onSelectAllRoomsChange: (selectAll: boolean) => void;
  availableRooms: Array<{ id: string; name: string }>;
  selectedAvailability: string[];
  onSelectedAvailabilityChange: (availability: string[]) => void;
  availabilityOptions: Array<{ id: string; label: string; color: string; hasReason?: boolean }>;
  stopSellReason: string;
  onStopSellReasonChange: (reason: string) => void;
  onUpdate: () => void;
  onReset: () => void;
  roomSearchFilter: string;
  onRoomSearchFilterChange: (filter: string) => void;
  minStayNights: string;
  onMinStayNightsChange: (nights: string) => void;
  maxStayNights: string;
  onMaxStayNightsChange: (nights: string) => void;
  rateOverrideType: 'none' | 'percentage' | 'fixed';
  onRateOverrideTypeChange: (type: 'none' | 'percentage' | 'fixed') => void;
  rateOverrideValue: number;
  onRateOverrideValueChange: (value: number) => void;
  ratePlans: Array<{ id: string; name: string; base_price?: number }>;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function BulkAvailabilityPanel({
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
  selectedRoomType,
  onSelectedRoomTypeChange,
  roomTypes,
  selectedRooms,
  onSelectedRoomsChange,
  selectAllRooms,
  onSelectAllRoomsChange,
  availableRooms,
  selectedAvailability,
  onSelectedAvailabilityChange,
  availabilityOptions,
  stopSellReason,
  onStopSellReasonChange,
  onUpdate,
  onReset,
  roomSearchFilter,
  onRoomSearchFilterChange,
  minStayNights,
  onMinStayNightsChange,
  maxStayNights,
  onMaxStayNightsChange,
  rateOverrideType,
  onRateOverrideTypeChange,
  rateOverrideValue,
  onRateOverrideValueChange,
  ratePlans,
}: BulkAvailabilityPanelProps) {
  const [expandChannels, setExpandChannels] = useState(false);
  const [expandAvailability, setExpandAvailability] = useState(false);

  // Filter rooms based on search
  const filteredRooms = availableRooms.filter(room => 
    room.name.toLowerCase().includes(roomSearchFilter.toLowerCase()) ||
    room.id.toLowerCase().includes(roomSearchFilter.toLowerCase())
  );

  const handleChannelToggle = (channelId: string) => {
    if (channelId === 'all') {
      onSelectedChannelsChange(selectedChannels.includes('all') ? [] : ['all']);
    } else {
      const others = selectedChannels.filter(c => c !== 'all');
      if (others.includes(channelId)) {
        onSelectedChannelsChange(others.filter(c => c !== channelId));
      } else {
        onSelectedChannelsChange([...others, channelId]);
      }
    }
  };

  const handleAvailabilityToggle = (availabilityId: string) => {
    if (selectedAvailability.includes(availabilityId)) {
      onSelectedAvailabilityChange(selectedAvailability.filter(a => a !== availabilityId));
    } else {
      onSelectedAvailabilityChange([...selectedAvailability, availabilityId]);
    }
  };

  const handleRoomToggle = (roomId: string) => {
    if (selectedRooms.includes(roomId)) {
      onSelectedRoomsChange(selectedRooms.filter(r => r !== roomId));
      onSelectAllRoomsChange(false);
    } else {
      onSelectedRoomsChange([...selectedRooms, roomId]);
    }
  };

  const handleSelectAllRooms = (selectAll: boolean) => {
    onSelectAllRoomsChange(selectAll);
    if (selectAll) {
      onSelectedRoomsChange(availableRooms.map(r => r.id));
    } else {
      onSelectedRoomsChange([]);
    }
  };

  const handleSelectAllDays = (selectAll: boolean) => {
    onSelectAllDaysChange(selectAll);
    if (selectAll) {
      onSelectedDaysChange([]);
    } else {
      onSelectedDaysChange([]);
    }
  };

  const handleToggleDayOfWeek = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      onSelectedDaysChange(selectedDays.filter(d => d !== dayIndex));
      onSelectAllDaysChange(false);
    } else {
      onSelectedDaysChange([...selectedDays, dayIndex]);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {/* Date Range */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Date Range</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start ? dateToString(dateRange.start) : ''}
              onChange={(e) => {
                const newStart = e.target.value ? stringToDate(e.target.value) : null;
                console.log('[DateRangePanel] Start date changed:', {
                  inputValue: e.target.value,
                  parsedDate: newStart,
                  dateToString: newStart ? dateToString(newStart) : 'null',
                });
                onDateRangeChange({ ...dateRange, start: newStart });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">End Date</label>
            <input
              type="date"
              disabled={openEnded}
              value={dateRange.end ? dateToString(dateRange.end) : ''}
              onChange={(e) => {
                const newEnd = e.target.value ? stringToDate(e.target.value) : null;
                console.log('[DateRangePanel] End date changed:', {
                  inputValue: e.target.value,
                  parsedDate: newEnd,
                  dateToString: newEnd ? dateToString(newEnd) : 'null',
                });
                onDateRangeChange({ ...dateRange, end: newEnd });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={openEnded}
              onChange={(e) => onOpenEndedChange(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Open-ended</span>
          </label>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3" />

      {/* Days */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Days</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={selectAllDays}
              onChange={(e) => handleSelectAllDays(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>All Days</span>
          </label>
          {!selectAllDays && (
            <div className="pl-6 space-y-2">
              {DAYS_OF_WEEK.map((day, index) => (
                <label key={index} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(index)}
                    onChange={(e) => handleToggleDayOfWeek(index)}
                    className="rounded border-slate-300"
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3" />

      {/* Channels */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Channels</h3>
        <div className="relative">
          <button
            onClick={() => setExpandChannels(!expandChannels)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white flex items-center justify-between hover:border-slate-300 transition"
          >
            <span className="text-slate-700">{selectedChannels.includes('all') ? 'All Channels' : selectedChannels.length + ' selected'}</span>
            <ChevronDown className={`w-4 h-4 transition ${expandChannels ? 'rotate-180' : ''}`} />
          </button>
          {expandChannels && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              {channels.map((channel) => (
                <label key={channel.id} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel.id)}
                    onChange={() => handleChannelToggle(channel.id)}
                    className="rounded border-slate-300"
                  />
                  <span>{channel.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3" />

      {/* Availability Update (MOVED HERE - BEFORE ROOM TYPES) */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Availability Update</h3>
        <div className="relative">
          <button
            onClick={() => setExpandAvailability(!expandAvailability)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white flex items-center justify-between hover:border-slate-300 transition"
          >
            <span className="text-slate-700">{selectedAvailability.length > 0 ? selectedAvailability.length + ' selected' : 'Select options'}</span>
            <ChevronDown className={`w-4 h-4 transition ${expandAvailability ? 'rotate-180' : ''}`} />
          </button>
          {expandAvailability && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-80">
              {availabilityOptions.map((option) => {
                const descriptions: Record<string, string> = {
                  available: 'Room is open for reservations and can be booked',
                  stop_sell: 'Room is completely blocked from all bookings across all channels',
                  close_arrival: 'Guests cannot use this day as their arrival date',
                  close_departure: 'Guests cannot use this day as their departure date',
                  min_stay: 'Enforces a minimum number of nights required for bookings',
                  max_stay: 'Limits the maximum number of consecutive nights allowed',
                };
                const desc = descriptions[option.id] || 'Availability status';
                
                return (
                  <div key={option.id} className="px-3 py-2 border-b border-slate-100 last:border-b-0">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mb-2 group">
                      <input
                        type="checkbox"
                        checked={selectedAvailability.includes(option.id)}
                        onChange={() => handleAvailabilityToggle(option.id)}
                        className="rounded border-slate-300"
                      />
                      <span
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: option.color, opacity: 0.3 }}
                      />
                      <span>{option.label}</span>
                      <div className="relative">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
                        {/* Info Tooltip */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2.5 py-1.5 max-w-sm z-[100] pointer-events-none break-words text-center">
                          {desc}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-3 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </label>
                    {option.hasReason && selectedAvailability.includes(option.id) && (
                      <input
                        type="text"
                        placeholder="Optional reason..."
                        value={stopSellReason}
                        onChange={(e) => onStopSellReasonChange(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs mt-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                    {option.id === 'min_stay' && selectedAvailability.includes(option.id) && (
                      <input
                        type="number"
                        placeholder="Number of nights..."
                        min="1"
                        max="365"
                        value={minStayNights}
                        onChange={(e) => onMinStayNightsChange(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs mt-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                    {option.id === 'max_stay' && selectedAvailability.includes(option.id) && (
                      <input
                        type="number"
                        placeholder="Number of nights..."
                        min="1"
                        max="365"
                        value={maxStayNights}
                        onChange={(e) => onMaxStayNightsChange(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs mt-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3" />

      {/* Rate Override */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Seasonal Rate Override</h3>
        <div className="space-y-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={rateOverrideType === 'none'}
                onChange={() => onRateOverrideTypeChange('none')}
                className="rounded-full border-slate-300"
              />
              <span>No Override</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={rateOverrideType === 'percentage'}
                onChange={() => onRateOverrideTypeChange('percentage')}
                className="rounded-full border-slate-300"
              />
              <span>Percentage Change</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={rateOverrideType === 'fixed'}
                onChange={() => onRateOverrideTypeChange('fixed')}
                className="rounded-full border-slate-300"
              />
              <span>Fixed Price</span>
            </label>
          </div>

          {rateOverrideType === 'percentage' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Percentage Change</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="e.g., 20"
                  min="-100"
                  max="200"
                  value={rateOverrideValue}
                  onChange={(e) => onRateOverrideValueChange(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <span className="text-xs font-medium text-slate-600">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Positive = increase, Negative = discount</p>
            </div>
          )}

          {rateOverrideType === 'fixed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Fixed Price</label>
              <input
                type="number"
                placeholder="e.g., 150.00"
                min="0"
                step="0.01"
                value={rateOverrideValue}
                onChange={(e) => onRateOverrideValueChange(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-green-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
              />
              <p className="text-xs text-slate-500 mt-1">Price per night for this period</p>
            </div>
          )}

          {rateOverrideType !== 'none' && rateOverrideValue > 0 && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
              ✓ Rate override configured: {rateOverrideType === 'percentage' ? `${rateOverrideValue}%` : `$${rateOverrideValue.toFixed(2)}`}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3" />

      {/* Room Types */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">
          {selectedAvailability.includes('min_stay') || selectedAvailability.includes('max_stay') 
            ? 'Room Types' 
            : 'Room Types'}
        </h3>
        <select
          value={selectedRoomType}
          onChange={(e) => {
            onSelectedRoomTypeChange(e.target.value);
            onSelectAllRoomsChange(true);
            onSelectedRoomsChange([]);
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All Room Types</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>{rt.name}</option>
          ))}
        </select>
        
        {/* Info message when min/max stay, CTA, or CTD is selected */}
        {(selectedAvailability.includes('min_stay') || 
          selectedAvailability.includes('max_stay') ||
          selectedAvailability.includes('close_arrival') ||
          selectedAvailability.includes('close_departure')) && (
          <p className="text-xs text-blue-600 mt-2 flex items-start gap-1">
            <span className="mt-0.5">ℹ️</span>
            <span>
              {selectedAvailability.includes('min_stay') || selectedAvailability.includes('max_stay') 
                ? 'Min/Max Stay restrictions' 
                : selectedAvailability.includes('close_arrival') || selectedAvailability.includes('close_departure')
                ? 'CTA/CTD settings'
                : 'Selected settings'} apply to room types only
            </span>
          </p>
        )}
      </div>

      {/* Rooms (HIDDEN when Min Stay, Max Stay, CTA, or CTD is selected) */}
      {selectedRoomType !== 'all' && 
       !selectedAvailability.includes('min_stay') && 
       !selectedAvailability.includes('max_stay') && 
       !selectedAvailability.includes('close_arrival') && 
       !selectedAvailability.includes('close_departure') && (
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">Rooms</h3>
          <div className="space-y-2">
            {/* Room Search Field */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={roomSearchFilter}
                onChange={(e) => onRoomSearchFilterChange(e.target.value)}
                className="flex-1 bg-transparent border-none text-xs focus:outline-none ml-2 placeholder-slate-400"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={selectAllRooms}
                onChange={(e) => handleSelectAllRooms(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Select All Rooms</span>
            </label>
            <div className="pl-6 space-y-2 max-h-40 overflow-y-auto">
              {filteredRooms.length > 0 ? (
                filteredRooms.map((room) => (
                  <label key={room.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAllRooms || selectedRooms.includes(room.id)}
                      onChange={(e) => handleRoomToggle(room.id)}
                      disabled={selectAllRooms}
                      className="rounded border-slate-300"
                    />
                    <span>{room.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No rooms match search</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3" />

      {/* CTAs */}
      <div className="space-y-2 sticky bottom-0 bg-white pt-2">
        <button
          onClick={onUpdate}
          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-md"
        >
          <Check className="w-4 h-4" />
          Update
        </button>
        <button
          onClick={onReset}
          className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  );
}
