"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DateRangePicker, SplitDateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { RoomType } from '@/types/roomType';

export interface BaseRate {
  id: string;
  property_id: string;
  room_type_id: string;
  name: string;
  base_price: number;
  start_date: string;
  end_date: string | null;
  extra_adult_price?: number;
  extra_adult_price_type?: 'fixed' | 'percentage';
  extra_child_price?: number;
  extra_child_price_type?: 'fixed' | 'percentage';
  single_use_discount?: number | null;
  single_use_discount_type?: 'fixed' | 'percentage';
  min_los?: number | null;
  max_los?: number | null;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  day_prices?: Record<string, number>;
  applied_days?: string[];
}

interface BaseRateFormProps {
  initialData?: BaseRate | null;
  availableRoomTypes: RoomType[];
  onSave: (formData: any) => Promise<void>;
  onClose: () => void;
  propertyId: string;
}

export default function BaseRateForm({
  initialData,
  availableRoomTypes,
  onSave,
  onClose,
  propertyId,
}: BaseRateFormProps) {
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(initialData?.room_type_id || '');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: initialData?.start_date ? new Date(initialData.start_date) : null,
    endDate: initialData?.end_date ? new Date(initialData.end_date) : null,
  });
  const startDate = dateRange.startDate;
  const endDate = dateRange.endDate;

  // Occupancy pricing
  const [chargeForAdditional, setChargeForAdditional] = useState(
    (initialData?.extra_adult_price || 0) > 0 || (initialData?.extra_child_price || 0) > 0
  );
  const [extraAdultPrice, setExtraAdultPrice] = useState(initialData?.extra_adult_price?.toString() || '0');
  const [extraChildPrice, setExtraChildPrice] = useState(initialData?.extra_child_price?.toString() || '0');
  const [extraAdultPriceType, setExtraAdultPriceType] = useState<'fixed' | 'percentage'>(
    initialData?.extra_adult_price_type || 'fixed'
  );
  const [extraChildPriceType, setExtraChildPriceType] = useState<'fixed' | 'percentage'>(
    initialData?.extra_child_price_type || 'fixed'
  );

  // Occupancy included in base rate (from room type)
  const [adultsIncluded, setAdultsIncluded] = useState<number | null>(null);
  const [childrenIncluded, setChildrenIncluded] = useState<number | null>(null);

  // Update occupancy values when room type is selected
  React.useEffect(() => {
    const roomType = availableRoomTypes.find(rt => rt.id === selectedRoomTypeId);
    if (roomType) {
      setAdultsIncluded(roomType.adultsIncludedInBaseRate || null);
      setChildrenIncluded(roomType.childrenIncludedInBaseRate || null);
    } else {
      setAdultsIncluded(null);
      setChildrenIncluded(null);
    }
  }, [selectedRoomTypeId, availableRoomTypes]);
  
  // Discount rule (conditional)
  const [singleUseDiscount, setSingleUseDiscount] = useState(initialData?.single_use_discount?.toString() || '0');
  const [singleUseDiscountType, setSingleUseDiscountType] = useState<'fixed' | 'percentage'>(
    initialData?.single_use_discount_type || 'percentage'
  );

  // Days and pricing — initialise from initialData.day_prices if editing
  interface DayPrice { day: string; price: string; enabled: boolean; }
  const DAY_KEYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const [dayPrices, setDayPrices] = useState<DayPrice[]>(() => {
    const dp = initialData?.day_prices ?? {};
    const active = initialData?.applied_days ?? DAY_KEYS;
    const fallback = initialData?.base_price?.toString() ?? '';
    return DAY_KEYS.map(d => ({
      day: d,
      price: dp[d] != null ? String(dp[d]) : fallback,
      enabled: active.includes(d),
    }));
  });

  // Derived base_price: average of enabled days with a valid price
  const derivedBasePrice = useMemo(() => {
    const enabled = dayPrices.filter(d => d.enabled && parseFloat(d.price) > 0);
    if (enabled.length === 0) return 0;
    return enabled.reduce((sum, d) => sum + parseFloat(d.price), 0) / enabled.length;
  }, [dayPrices]);

  // Restrictions
  const [minLos, setMinLos] = useState(initialData?.min_los?.toString() || '');
  const [maxLos, setMaxLos] = useState(initialData?.max_los?.toString() || '');
  const [closedToArrival, setClosedToArrival] = useState(initialData?.closed_to_arrival ?? false);
  const [closedToDeparture, setClosedToDeparture] = useState(initialData?.closed_to_departure ?? false);

  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get standard occupancy for the selected room type
  const selectedRoomType = useMemo(() => {
    return availableRoomTypes.find(rt => rt.id === selectedRoomTypeId);
  }, [selectedRoomTypeId, availableRoomTypes]);

  const standardOccupancy = selectedRoomType?.maxGuests || 0;
  const showDiscountRule = standardOccupancy > 1 && selectedRoomType?.adultsIncludedInBaseRate !== 1;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedRoomTypeId) {
      newErrors.roomType = 'Room type is required';
    }

    const enabledDays = dayPrices.filter(d => d.enabled && parseFloat(d.price) > 0);
    if (enabledDays.length === 0) {
      newErrors.dayPrices = 'At least one day must be enabled with a price greater than 0';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!endDate) {
      newErrors.endDate = 'End date is required';
    } else if (startDate && endDate < startDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    // Validate occupancy pricing
    const adjAdultPrice = parseFloat(extraAdultPrice || '0');
    const adjChildPrice = parseFloat(extraChildPrice || '0');
    if (adjAdultPrice < 0) {
      newErrors.extraAdultPrice = 'Extra adult price cannot be negative';
    }
    if (adjChildPrice < 0) {
      newErrors.extraChildPrice = 'Extra child price cannot be negative';
    }

    // Validate restrictions
    if (minLos) {
      const minValue = parseInt(minLos);
      if (isNaN(minValue) || minValue < 1) {
        newErrors.minLos = 'Minimum length of stay must be at least 1';
      }
    }

    if (maxLos) {
      const maxValue = parseInt(maxLos);
      const minValue = minLos ? parseInt(minLos) : 0;
      if (isNaN(maxValue) || maxValue < 1) {
        newErrors.maxLos = 'Maximum length of stay must be at least 1';
      }
      if (minLos && maxValue < minValue) {
        newErrors.maxLos = 'Maximum length of stay must be greater than minimum';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    // Build day_prices map and applied_days array from the table state
    const dayPricesMap: Record<string, number> = {};
    const appliedDays: string[] = [];
    dayPrices.forEach(dp => {
      const p = parseFloat(dp.price);
      if (!isNaN(p)) dayPricesMap[dp.day] = p;
      if (dp.enabled) appliedDays.push(dp.day);
    });
    const payload = {
      room_type_id: selectedRoomTypeId,
      base_price: derivedBasePrice,
      day_prices: dayPricesMap,
      applied_days: appliedDays,
      start_date: startDate ? startDate.toISOString().split('T')[0] : undefined,
      end_date: endDate ? endDate.toISOString().split('T')[0] : undefined,
      extra_adult_price: parseFloat(extraAdultPrice || '0'),
      extra_adult_price_type: extraAdultPriceType,
      extra_child_price: parseFloat(extraChildPrice || '0'),
      extra_child_price_type: extraChildPriceType,
      single_use_discount: showDiscountRule ? parseFloat(singleUseDiscount || '0') : null,
      single_use_discount_type: singleUseDiscountType,
      min_los: minLos ? parseInt(minLos) : null,
      max_los: maxLos ? parseInt(maxLos) : null,
      closed_to_arrival: closedToArrival,
      closed_to_departure: closedToDeparture,
      is_active: isActive,
    };
    try {
      await onSave(payload);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <form id="baseRateForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-4 pb-20">
        {/* Form Title */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {initialData ? 'Edit Base Rate' : 'Add Base Rate'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {initialData ? 'Update the details of this base rate' : 'Create a new base rate for your property'}
          </p>
        </div>

      {/* Row 1: Room Type | Start Date | End Date */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="roomType" className="text-sm font-medium">Room Type *</Label>
          <Select value={selectedRoomTypeId} onValueChange={setSelectedRoomTypeId} disabled={!!initialData}>
            <SelectTrigger id="roomType" className={cn(errors.roomType && 'border-destructive')}>
              <SelectValue placeholder="Select room type..." />
            </SelectTrigger>
            <SelectContent>
              {availableRoomTypes.map(rt => (
                <SelectItem key={rt.id} value={rt.id}>
                  {rt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.roomType && <p className="text-xs text-destructive">{errors.roomType}</p>}
        </div>

        <div className="col-span-2">
          <SplitDateRangePicker
            value={dateRange}
            onChange={setDateRange}
            startId="startDate"
            endId="endDate"
            startLabel="Start Date *"
            endLabel="End Date *"
            startPlaceholder="Pick a date"
            endPlaceholder="Pick a date"
            startError={!!errors.startDate}
            startErrorMessage={errors.startDate}
            endError={!!errors.endDate}
            endErrorMessage={errors.endDate}
          />
        </div>
      </div>

      {/* Row 2: Min LOS | Max LOS | Closed to Arrival | Closed to Departure */}
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minLos" className="text-sm font-medium">Min LOS</Label>
          <Input
            id="minLos"
            type="number"
            min="1"
            placeholder="e.g., 2"
            value={minLos}
            onChange={(e) => setMinLos(e.target.value)}
            className={cn(errors.minLos && 'border-destructive')}
          />
          {errors.minLos && <p className="text-xs text-destructive">{errors.minLos}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxLos" className="text-sm font-medium">Max LOS</Label>
          <Input
            id="maxLos"
            type="number"
            min="1"
            placeholder="e.g., 30"
            value={maxLos}
            onChange={(e) => setMaxLos(e.target.value)}
            className={cn(errors.maxLos && 'border-destructive')}
          />
          {errors.maxLos && <p className="text-xs text-destructive">{errors.maxLos}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Closed to Arrival</Label>
          <RadioGroup value={closedToArrival ? 'yes' : 'no'} onValueChange={(val) => setClosedToArrival(val === 'yes')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="arrivalYes" />
              <Label htmlFor="arrivalYes" className="text-sm font-normal cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="arrivalNo" />
              <Label htmlFor="arrivalNo" className="text-sm font-normal cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Closed to Departure</Label>
          <RadioGroup value={closedToDeparture ? 'yes' : 'no'} onValueChange={(val) => setClosedToDeparture(val === 'yes')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="departureYes" />
              <Label htmlFor="departureYes" className="text-sm font-normal cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="departureNo" />
              <Label htmlFor="departureNo" className="text-sm font-normal cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Do you charge for additional adults or children? */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/40">
        {/* Display occupancy included in base rate */}
        {(adultsIncluded !== null || childrenIncluded !== null) && (
          <div className="mb-4 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm font-medium text-foreground mb-2">Included in Base Rate:</p>
            <div className="flex gap-6">
              {adultsIncluded !== null && (
                <div className="text-sm">
                  <span className="font-medium">{adultsIncluded}</span>
                  <span className="text-muted-foreground"> adults</span>
                </div>
              )}
              {childrenIncluded !== null && (
                <div className="text-sm">
                  <span className="font-medium">{childrenIncluded}</span>
                  <span className="text-muted-foreground"> children</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Label className="text-sm font-medium">Do you charge for additional adults or children?</Label>
        <RadioGroup 
          value={chargeForAdditional ? 'yes' : 'no'}
          onValueChange={(val) => {
            if (val === 'no') {
              setChargeForAdditional(false);
              setExtraAdultPrice('0');
              setExtraChildPrice('0');
            } else {
              setChargeForAdditional(true);
            }
          }}
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="chargeYes" />
              <Label htmlFor="chargeYes" className="text-sm font-normal cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="chargeNo" />
              <Label htmlFor="chargeNo" className="text-sm font-normal cursor-pointer">No</Label>
            </div>
          </div>
        </RadioGroup>

        {/* Conditional: Adults and Children fields */}
        {chargeForAdditional && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Price per Additional Adult</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="extraAdultPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={extraAdultPrice}
                      onChange={(e) => setExtraAdultPrice(e.target.value)}
                      className={cn(errors.extraAdultPrice && 'border-destructive', 'flex-1')}
                    />
                    <RadioGroup value={extraAdultPriceType} onValueChange={(val) => setExtraAdultPriceType(val as 'fixed' | 'percentage')}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="fixed" id="adultFixed" />
                          <Label htmlFor="adultFixed" className="text-xs font-normal cursor-pointer">Fixed</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="percentage" id="adultPercent" />
                          <Label htmlFor="adultPercent" className="text-xs font-normal cursor-pointer">%</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                {adultsIncluded !== null && (
                  <p className="text-xs text-muted-foreground">Charge applies to guests beyond the {adultsIncluded} adult{adultsIncluded !== 1 ? 's' : ''} included</p>
                )}
                {errors.extraAdultPrice && <p className="text-xs text-destructive">{errors.extraAdultPrice}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Price per Additional Child</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="extraChildPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={extraChildPrice}
                      onChange={(e) => setExtraChildPrice(e.target.value)}
                      className={cn(errors.extraChildPrice && 'border-destructive', 'flex-1')}
                    />
                    <RadioGroup value={extraChildPriceType} onValueChange={(val) => setExtraChildPriceType(val as 'fixed' | 'percentage')}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="fixed" id="childFixed" />
                          <Label htmlFor="childFixed" className="text-xs font-normal cursor-pointer">Fixed</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="percentage" id="childPercent" />
                          <Label htmlFor="childPercent" className="text-xs font-normal cursor-pointer">%</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                {childrenIncluded !== null && (
                  <p className="text-xs text-muted-foreground">Charge applies to guests beyond the {childrenIncluded} child{childrenIncluded !== 1 ? 'ren' : ''} included</p>
                )}
                {errors.extraChildPrice && <p className="text-xs text-destructive">{errors.extraChildPrice}</p>}
              </div>
            </div>

            {/* Discount Rule - Conditional (only if standard_occupancy > 1) */}
            {showDiscountRule && (
              <div className="space-y-2 p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">🔻 Discount Rule (conditional)</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Single-Occupancy Discount (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="singleUseDiscount"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="e.g., 10"
                      value={singleUseDiscount}
                      onChange={(e) => setSingleUseDiscount(e.target.value)}
                      className="flex-1"
                    />
                    <RadioGroup value={singleUseDiscountType} onValueChange={(val) => setSingleUseDiscountType(val as 'fixed' | 'percentage')}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="fixed" id="discountFixed" />
                          <Label htmlFor="discountFixed" className="text-xs font-normal cursor-pointer">Fixed</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="percentage" id="discountPercent" />
                          <Label htmlFor="discountPercent" className="text-xs font-normal cursor-pointer">%</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Optional discount for single-occupancy bookings ({singleUseDiscountType === 'fixed' ? 'fixed amount' : 'percentage'})
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Days and Pricing Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Day-of-week pricing *
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Enable days and set a price for each. Use "Apply to All" to bulk-fill.
            </span>
          </Label>
          {derivedBasePrice > 0 && (
            <span className="text-xs text-muted-foreground">
              Avg price: <span className="font-semibold text-foreground">{derivedBasePrice.toFixed(2)}</span>
            </span>
          )}
        </div>
        {errors.dayPrices && (
          <p className="text-xs text-destructive">{errors.dayPrices}</p>
        )}

        {/* Days Grid Table */}
        <div className={cn("overflow-x-auto border rounded-lg", errors.dayPrices && "border-destructive")}>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted">
                <th className="p-3 text-center text-sm font-medium w-32">Default Price</th>
                <th className="p-3 text-center text-sm font-medium w-32">Apply to All</th>
                {dayPrices.map((dp) => (
                  <th key={dp.day} className="p-3 text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        id={`day-${dp.day}`}
                        checked={dp.enabled}
                        onCheckedChange={(checked) => {
                          const newPrices = dayPrices.map(p => 
                            p.day === dp.day ? { ...p, enabled: checked as boolean } : p
                          );
                          setDayPrices(newPrices);
                        }}
                      />
                      <label htmlFor={`day-${dp.day}`} className="cursor-pointer">
                        {dp.day}
                      </label>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 text-center border-r">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="$100.00"
                    defaultValue={derivedBasePrice > 0 ? derivedBasePrice.toFixed(2) : ''}
                    id="applyPrice"
                    className="text-center text-sm"
                  />
                </td>
                <td className="p-3 text-center border-r">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 w-full"
                    onClick={() => {
                      const price = (document.getElementById('applyPrice') as HTMLInputElement)?.value;
                      if (price) {
                        const newPrices = dayPrices.map(p => ({ ...p, price }));
                        setDayPrices(newPrices);
                      }
                    }}
                  >
                    APPLY
                  </Button>
                </td>
                {dayPrices.map((dp) => (
                  <td key={dp.day} className="p-3 text-center border-r">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="$100.00"
                      value={dp.price}
                      onChange={(e) => {
                        const newPrices = dayPrices.map(p => 
                          p.day === dp.day ? { ...p, price: e.target.value } : p
                        );
                        setDayPrices(newPrices);
                      }}
                      className="text-center text-sm"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/40">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked as boolean)}
        />
        <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
          Active (available for use)
        </Label>
      </div>


      </form>

      {/* Form Actions - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 border-t bg-background flex justify-end gap-3 z-50">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          CANCEL
        </Button>
        <Button type="submit" form="baseRateForm" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          {isSaving ? (
            <>
              <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            initialData ? 'UPDATE BASE RATE' : 'ADD BASE RATE'
          )}
        </Button>
      </div>
    </div>
  );
}
