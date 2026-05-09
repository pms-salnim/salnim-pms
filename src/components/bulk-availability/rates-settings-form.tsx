'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RatePlan } from '@/types/ratePlan';

interface RoomType {
  id: string;
  name: string;
}

interface RatesSettingsFormProps {
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
  rateOverrideType: 'none' | 'percentage' | 'fixed';
  onRateOverrideTypeChange: (type: 'none' | 'percentage' | 'fixed') => void;
  rateOverrideValue: number;
  onRateOverrideValueChange: (value: number) => void;
  derivePricing: boolean;
  onDerivePricingChange: (checked: boolean) => void;
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  selectedRatePlans: string[];
  onSelectedRatePlansChange: (ratePlanIds: string[]) => void;
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

const RATE_OVERRIDE_OPTIONS = [
  { id: 'none', label: 'No Override' },
  { id: 'percentage', label: 'Percentage (%)' },
  { id: 'fixed', label: 'Fixed Price' },
];

export function RatesSettingsForm({
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
  rateOverrideType,
  onRateOverrideTypeChange,
  rateOverrideValue,
  onRateOverrideValueChange,
  derivePricing,
  onDerivePricingChange,
  roomTypes,
  ratePlans,
  selectedRatePlans,
  onSelectedRatePlansChange,
  onUpdate,
  onReset,
}: RatesSettingsFormProps) {
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

  const handleRatePlanToggle = (ratePlanId: string) => {
    const newRatePlans = selectedRatePlans.includes(ratePlanId)
      ? selectedRatePlans.filter(r => r !== ratePlanId)
      : [...selectedRatePlans, ratePlanId];
    onSelectedRatePlansChange(newRatePlans);
  };

  // Validation helpers
  const isDateRangeValid = !dateRange.start || !dateRange.end || dateRange.start <= dateRange.end;
  const dateError = dateRange.start && dateRange.end && dateRange.start > dateRange.end 
    ? 'End date must be after start date' 
    : null;
  const isPercentageValid = rateOverrideType === 'percentage' 
    ? rateOverrideValue >= -100 && rateOverrideValue <= 100 
    : true;
  const percentageError = rateOverrideType === 'percentage' && (rateOverrideValue < -100 || rateOverrideValue > 100)
    ? 'Percentage must be between -100% and +100%'
    : null;
  const isFixedPriceValid = rateOverrideType === 'fixed' 
    ? rateOverrideValue >= 0 
    : true;
  const fixedPriceError = rateOverrideType === 'fixed' && rateOverrideValue < 0
    ? 'Fixed price must be 0 or greater'
    : null;
  const isFormValid = isDateRangeValid && isPercentageValid && isFixedPriceValid;

  // Group rate plans by room type
  const ratePlansByRoomType = roomTypes.reduce((acc, roomType) => {
    const plansForType = ratePlans.filter(plan => plan.roomTypeId === roomType.id);
    if (plansForType.length > 0) {
      acc[roomType.id] = {
        name: roomType.name,
        plans: plansForType,
      };
    }
    return acc;
  }, {} as Record<string, { name: string; plans: RatePlan[] }>);

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

      {/* Rate Override Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Rate Override</label>
        <div className="space-y-2">
          {/* Override Type */}
          <div className="grid grid-cols-3 gap-2">
            {RATE_OVERRIDE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onRateOverrideTypeChange(option.id as 'none' | 'percentage' | 'fixed')}
                className={`py-1.5 px-2 text-xs font-semibold rounded border-2 transition ${
                  rateOverrideType === option.id
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Override Value Input */}
          {rateOverrideType !== 'none' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="override-value" className="text-xs font-semibold text-slate-900">
                {rateOverrideType === 'percentage' ? 'Percentage (%)' : 'Fixed Price'}
              </label>
              <input
                id="override-value"
                type="number"
                min={rateOverrideType === 'percentage' ? '-100' : '0'}
                max={rateOverrideType === 'percentage' ? '100' : undefined}
                step={rateOverrideType === 'percentage' ? '1' : '0.01'}
                value={rateOverrideValue}
                onChange={(e) => onRateOverrideValueChange(parseFloat(e.target.value) || 0)}
                placeholder={rateOverrideType === 'percentage' ? 'e.g., 20 for +20%' : 'e.g., 150.00'}
                className={`px-2 py-1.5 text-xs border rounded bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  percentageError || fixedPriceError ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {percentageError && (
                <p className="text-xs text-red-600 font-medium">{percentageError}</p>
              )}
              {fixedPriceError && (
                <p className="text-xs text-red-600 font-medium">{fixedPriceError}</p>
              )}
            </div>
          )}

          {/* Derive Pricing */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="derive-pricing"
              checked={derivePricing}
              onCheckedChange={(checked) => onDerivePricingChange(checked === true)}
            />
            <label htmlFor="derive-pricing" className="text-xs text-slate-600 cursor-pointer flex-1">
              Derive pricing from base rates
            </label>
          </div>
        </div>
      </div>

      {/* Rate Plans by Room Type Section */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-slate-900">Apply to Rate Plans</label>
        <div className="space-y-1.5 border border-slate-200 rounded-lg overflow-hidden">
          {Object.entries(ratePlansByRoomType).length > 0 ? (
            Object.entries(ratePlansByRoomType).map(([roomTypeId, { name, plans }]) => {
              const isExpanded = expandedRoomTypes.has(roomTypeId);
              const allPlansSelected = plans.every(p => selectedRatePlans.includes(p.id));
              const somePlansSelected = plans.some(p => selectedRatePlans.includes(p.id));

              return (
                <div key={roomTypeId} className="border-b last:border-b-0">
                  {/* Room Type Header */}
                  <div className="px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                    {somePlansSelected && !allPlansSelected ? (
                      <Checkbox
                        checked="indeterminate"
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onSelectedRatePlansChange([
                              ...selectedRatePlans,
                              ...plans.filter(p => !selectedRatePlans.includes(p.id)).map(p => p.id),
                            ]);
                          } else {
                            onSelectedRatePlansChange(
                              selectedRatePlans.filter(r => !plans.map(p => p.id).includes(r))
                            );
                          }
                        }}
                      />
                    ) : (
                      <Checkbox
                        checked={allPlansSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onSelectedRatePlansChange([
                              ...selectedRatePlans,
                              ...plans.filter(p => !selectedRatePlans.includes(p.id)).map(p => p.id),
                            ]);
                          } else {
                            onSelectedRatePlansChange(
                              selectedRatePlans.filter(r => !plans.map(p => p.id).includes(r))
                            );
                          }
                        }}
                      />
                    )}
                    <button
                      onClick={() => toggleRoomTypeExpanded(roomTypeId)}
                      className="flex items-center gap-2 flex-1 hover:bg-slate-100 rounded px-1 py-1 transition"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                      />
                      <span className="text-xs font-semibold text-slate-900 flex-1">{name}</span>
                    </button>
                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedRatePlans.filter(r => plans.map(p => p.id).includes(r)).length}/{plans.length}
                    </span>
                  </div>

                  {/* Rate Plans List */}
                  {isExpanded && plans.length > 0 && (
                    <div className="bg-slate-50 px-3 py-2 space-y-1.5 border-t border-slate-200">
                      {plans.map((plan) => (
                        <div key={plan.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`plan-${plan.id}`}
                            checked={selectedRatePlans.includes(plan.id)}
                            onCheckedChange={() => handleRatePlanToggle(plan.id)}
                          />
                          <label htmlFor={`plan-${plan.id}`} className="text-xs text-slate-600 cursor-pointer flex-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-slate-900">{plan.planName}</span>
                              {plan.basePrice && (
                                <span className="text-xs text-slate-500">
                                  Base: ${plan.basePrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              No rate plans available
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={onUpdate}
          disabled={!isFormValid}
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
