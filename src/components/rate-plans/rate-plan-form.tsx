
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Icons } from "@/components/icons";
import type { RoomType } from '@/types/roomType';
import type { RatePlan, PricingMethod } from '@/types/ratePlan';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfDay } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { type DateRange } from 'react-day-picker';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BaseRate {
  id: string;
  base_price: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

interface RatePlanFormProps {
  initialData: RatePlan | null;
  availableRoomTypes: RoomType[];
  onSave: (data: Omit<RatePlan, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onClose: () => void;
  propertyId: string; 
}

export default function RatePlanForm({ initialData, availableRoomTypes, onSave, onClose, propertyId }: RatePlanFormProps) {
  const { t } = useTranslation('pages/rate-plans/all/content');
  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('per_guest');
  const [pricingPerGuest, setPricingPerGuest] = useState<Record<string, string>>({});
  const [basePrice, setBasePrice] = useState<string>('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [isDefaultPlan, setIsDefaultPlan] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isOpenEnded, setIsOpenEnded] = useState(false);
  
  // New base rate derivation fields
  const [useBaseRateDerivation, setUseBaseRateDerivation] = useState(false);
  const [baseRates, setBaseRates] = useState<BaseRate[]>([]);
  const [selectedBaseRateId, setSelectedBaseRateId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'none' | 'fixed' | 'percentage'>('none');
  const [adjustmentValue, setAdjustmentValue] = useState<string>('0');
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [isLoadingBaseRates, setIsLoadingBaseRates] = useState(false);

  // Advanced debugging wrapper for date range changes
  const handleDateRangeChange = (newDateRange: DateRange | undefined) => {
    console.group('[RatePlanForm] 📅 DATE PICKER CHANGED');
    console.log('Time:', new Date().toLocaleTimeString());
    console.log('Raw dateRange object:', newDateRange);
    
    if (newDateRange?.from) {
      console.log('FROM date object:', {
        jsDate: newDateRange.from,
        iso: newDateRange.from.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        local: `${newDateRange.from.getFullYear()}-${String(newDateRange.from.getMonth() + 1).padStart(2, '0')}-${String(newDateRange.from.getDate()).padStart(2, '0')}`,
        components: {
          year: newDateRange.from.getFullYear(),
          month: newDateRange.from.getMonth() + 1,
          day: newDateRange.from.getDate(),
          hours: newDateRange.from.getHours(),
          minutes: newDateRange.from.getMinutes(),
          seconds: newDateRange.from.getSeconds(),
        }
      });
    }
    
    if (newDateRange?.to) {
      console.log('TO date object:', {
        jsDate: newDateRange.to,
        iso: newDateRange.to.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        local: `${newDateRange.to.getFullYear()}-${String(newDateRange.to.getMonth() + 1).padStart(2, '0')}-${String(newDateRange.to.getDate()).padStart(2, '0')}`,
        components: {
          year: newDateRange.to.getFullYear(),
          month: newDateRange.to.getMonth() + 1,
          day: newDateRange.to.getDate(),
          hours: newDateRange.to.getHours(),
          minutes: newDateRange.to.getMinutes(),
          seconds: newDateRange.to.getSeconds(),
        }
      });
    }
    
    console.groupEnd();
    setDateRange(newDateRange);
  };

  const selectedRoomType = availableRoomTypes.find(rt => rt.id === selectedRoomTypeId);
  const maxGuestsForType = selectedRoomType ? selectedRoomType.maxGuests : 0;
  
  const guestCountKeys = Array.from({ length: maxGuestsForType }, (_, i) => String(i + 1));

  useEffect(() => {
    if (initialData) {
      setPlanName(initialData.planName);
      setDescription(initialData.description || '');
      setSelectedRoomTypeId(initialData.roomTypeId);
      setPricingMethod(initialData.pricingMethod || 'per_guest');
      setBasePrice(initialData.basePrice !== undefined ? String(initialData.basePrice) : '');
      
      const initialPricingStrings: Record<string, string> = {};
      if (initialData.pricingPerGuest) {
          Object.keys(initialData.pricingPerGuest).forEach(key => {
            const val = initialData.pricingPerGuest?.[key];
            if (val !== undefined && val !== null) {
              initialPricingStrings[key] = String(val);
            }
          });
      }
      setPricingPerGuest(initialPricingStrings);
      setCancellationPolicy(initialData.cancellationPolicy || '');
      setIsDefaultPlan(initialData.default);
      
      // Convert dates - handle both Date objects and strings
      const startDate = initialData.startDate ? 
        (initialData.startDate instanceof Date ? initialData.startDate : new Date(initialData.startDate)) 
        : undefined;
      const endDate = initialData.endDate ? 
        (initialData.endDate instanceof Date ? initialData.endDate : new Date(initialData.endDate)) 
        : undefined;
      
      console.group('[RatePlanForm] 🔧 INITIAL DATA LOADED');
      console.log('Start date:', startDate);
      console.log('End date:', endDate);
      console.groupEnd();
      
      handleDateRangeChange({
        from: startDate,
        to: endDate,
      });
      setIsOpenEnded(!initialData.endDate);
    } else {
      setPlanName('');
      setDescription('');
      setSelectedRoomTypeId('');
      setPricingMethod('per_guest');
      setPricingPerGuest({});
      setBasePrice('');
      setCancellationPolicy('');
      setIsDefaultPlan(false);
      handleDateRangeChange({ from: new Date(), to: undefined });
      setIsOpenEnded(true);
    }
  }, [initialData]);
  
  useEffect(() => {
    if (isOpenEnded) {
      console.log('[RatePlanForm] 🔓 OPEN-ENDED MODE: Clearing end date');
      handleDateRangeChange(prev => ({ from: prev?.from, to: undefined }));
    }
  }, [isOpenEnded]);

  // Fetch base rates when room type or derivation mode changes
  useEffect(() => {
    if (useBaseRateDerivation && selectedRoomTypeId && propertyId) {
      fetchBaseRates();
    }
  }, [selectedRoomTypeId, useBaseRateDerivation, propertyId]);

  // Calculate price in real-time
  useEffect(() => {
    if (useBaseRateDerivation && selectedBaseRateId && baseRates.length > 0) {
      const selectedRate = baseRates.find(r => r.id === selectedBaseRateId);
      if (selectedRate) {
        const basePrice = selectedRate.base_price;
        let finalPrice = basePrice;

        if (adjustmentType === 'fixed') {
          finalPrice = basePrice + parseFloat(adjustmentValue || '0');
        } else if (adjustmentType === 'percentage') {
          const percentage = parseFloat(adjustmentValue || '0');
          finalPrice = basePrice + (basePrice * percentage / 100);
        }

        setCalculatedPrice(finalPrice);
        console.log(`[RatePlanForm] Calculated price: ${finalPrice} (Base: ${basePrice} + ${adjustmentType}(${adjustmentValue})`);
      }
    }
  }, [selectedBaseRateId, adjustmentType, adjustmentValue, baseRates, useBaseRateDerivation]);

  const fetchBaseRates = async () => {
    setIsLoadingBaseRates(true);
    try {
      const response = await fetch('/api/pricing/base-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'read',
          propertyId,
          baseRate: {
            room_type_id: selectedRoomTypeId
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setBaseRates(result.data || []);
        console.log('[RatePlanForm] Fetched base rates:', result.data);
      } else {
        console.error('Failed to fetch base rates');
        toast({ title: 'Error', description: 'Could not fetch base rates', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching base rates:', error);
      toast({ title: 'Error', description: 'Failed to load base rates', variant: 'destructive' });
    } finally {
      setIsLoadingBaseRates(false);
    }
  };

  const saveDerivedRateAdjustments = async (ratePlanId: string) => {
    if (!useBaseRateDerivation) return;

    try {
      const response = await fetch('/api/pricing/rate-plan-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          ratePlanId,
          adjustment: {
            adjustment_type: adjustmentType,
            adjustment_value: parseFloat(adjustmentValue || '0'),
            is_derived_from_base: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save adjustment rules');
      }

      console.log('[RatePlanForm] Saved adjustment rules for rate plan:', ratePlanId);
    } catch (error) {
      console.error('Error saving adjustment rules:', error);
      throw error;
    }
  }

  useEffect(() => {
    // Reset pricing when room type changes to ensure consistency with new max guest count
    if (selectedRoomTypeId) {
      setPricingPerGuest({});
    }
  }, [selectedRoomTypeId]);

  const handlePricingChange = (guestCountKey: string, value: string) => {
    setPricingPerGuest(prev => ({
      ...prev,
      [guestCountKey]: value 
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    console.group('[RatePlanForm] 📤 FORM SUBMISSION');
    console.log('Time:', new Date().toLocaleTimeString());
    
    // Validate room type has valid max occupancy
    if (!selectedRoomTypeId || maxGuestsForType === 0) {
      toast({ 
        title: t('toasts.validation_error_title'), 
        description: 'Please select a room type with valid occupancy (more than 0 guests)', 
        variant: "destructive" 
      });
      console.groupEnd();
      return;
    }
    
    let hasPrice = false;
    const numericPricingPerGuest: Record<string, number> = {};

    if (pricingMethod === 'per_guest') {
        if (pricingPerGuest) {
            for (const key in pricingPerGuest) {
              if (pricingPerGuest[key] && pricingPerGuest[key].trim() !== '') {
                const numValue = parseFloat(pricingPerGuest[key]);
                if (!isNaN(numValue)) {
                  numericPricingPerGuest[key] = numValue;
                  hasPrice = true;
                }
              }
            }
        }
    } else { // per_night
        hasPrice = basePrice.trim() !== '' && !isNaN(parseFloat(basePrice));
    }


    if (!planName || !hasPrice || !dateRange?.from) {
        toast({ title: t('toasts.validation_error_title'), description: t('toasts.validation_error_description'), variant: "destructive" });
        console.groupEnd();
        return;
    }

    // Log detailed date information before submission
    console.log('📅 DATE RANGE SUBMISSION DEBUG:');
    if (dateRange.from) {
      const startDateForSubmit = startOfDay(dateRange.from);
      console.log('START date after startOfDay():', {
        jsDate: startDateForSubmit,
        iso: startDateForSubmit.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        formatted: `${startDateForSubmit.getFullYear()}-${String(startDateForSubmit.getMonth() + 1).padStart(2, '0')}-${String(startDateForSubmit.getDate()).padStart(2, '0')}`,
      });
    }
    
    if (dateRange.to && !isOpenEnded) {
      const endDateForSubmit = startOfDay(dateRange.to);
      console.log('END date after startOfDay():', {
        jsDate: endDateForSubmit,
        iso: endDateForSubmit.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        formatted: `${endDateForSubmit.getFullYear()}-${String(endDateForSubmit.getMonth() + 1).padStart(2, '0')}-${String(endDateForSubmit.getDate()).padStart(2, '0')}`,
      });
    }

    const ratePlanData = {
      planName,
      description,
      roomTypeId: selectedRoomTypeId,
      pricingMethod,
      cancellationPolicy,
      default: isDefaultPlan,
      startDate: startOfDay(dateRange.from),
      endDate: dateRange.to && !isOpenEnded ? startOfDay(dateRange.to) : null,
      ...(pricingMethod === 'per_night' && { basePrice: parseFloat(basePrice) }),
      ...(pricingMethod === 'per_guest' && { pricingPerGuest: numericPricingPerGuest }),
      // Add base rate derivation fields
      ...(useBaseRateDerivation && {
        adjustment_type: adjustmentType,
        adjustment_value: parseFloat(adjustmentValue || '0'),
        is_derived_from_base: true
      }),
    };
    
    console.log('🚀 FINAL DATA BEING SENT TO API:', ratePlanData);
    console.groupEnd();
    
    // Pass a callback to save adjustments after the main plan is created
    onSave({
      ...ratePlanData,
      _saveAdjustments: useBaseRateDerivation ? saveDerivedRateAdjustments : undefined
    } as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[75vh] overflow-y-auto pr-2">
      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.basic_info')}</h3>
        <div className="space-y-1 pt-1">
          <Label htmlFor="planName">{t('form.plan_name_label')} <span className="text-destructive">*</span></Label>
          <Input id="planName" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder={t('form.plan_name_placeholder')} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">{t('form.description_label')}</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.description_placeholder')} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.room_type_assoc')} <span className="text-destructive">*</span></h3>
        <div className="space-y-1 pt-1">
          <Label htmlFor="roomTypeSelect">{t('form.room_type_label')}</Label>
          <Select value={selectedRoomTypeId} onValueChange={setSelectedRoomTypeId} required>
            <SelectTrigger id="roomTypeSelect">
                <SelectValue placeholder={t('form.room_type_placeholder')} />
            </SelectTrigger>
            <SelectContent>
                {availableRoomTypes.length > 0 ? availableRoomTypes.map(rt => (
                <SelectItem key={rt.id} value={rt.id}>{rt.name} {rt.maxGuests > 0 ? `(${rt.maxGuests} guests)` : '(Invalid: 0 guests)'}</SelectItem>
                )) : <SelectItem value="none" disabled>{t('form.no_room_types')}</SelectItem>}
            </SelectContent>
          </Select>
          {selectedRoomTypeId && maxGuestsForType === 0 && (
            <p className="text-xs text-destructive pt-1">⚠️ This room type has invalid max occupancy (0 guests). Please select a different room type or update the room type settings.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.pricing')}</h3>
        <RadioGroup value={pricingMethod} onValueChange={(value) => setPricingMethod(value as PricingMethod)} className="flex gap-4 pt-1">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="per_guest" id="r_per_guest" />
              <Label htmlFor="r_per_guest" className="font-normal">{t('form.pricing_method_per_guest')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="per_night" id="r_per_night" />
              <Label htmlFor="r_per_night" className="font-normal">{t('form.pricing_method_per_night')}</Label>
            </div>
        </RadioGroup>
      </section>
      
      {selectedRoomTypeId && pricingMethod === 'per_guest' && (
        <section className="space-y-3 animate-in fade-in-50">
          {maxGuestsForType > 0 ? (
            <>
              <Label>{t('form.pricing_per_guest_label')} <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 pt-1">
                {guestCountKeys.map(numGuestsKey => (
                  <div key={numGuestsKey} className="space-y-1">
                    <Label htmlFor={`priceFor${numGuestsKey}Guests`}>{Number(numGuestsKey) > 1 ? t('form.guests_label', {count: numGuestsKey}) : t('form.guest_label', {count: numGuestsKey}) } ($)</Label>
                    <Input
                      id={`priceFor${numGuestsKey}Guests`}
                      type="number"
                      value={pricingPerGuest[numGuestsKey] || ''}
                      onChange={(e) => handlePricingChange(numGuestsKey, e.target.value)}
                      placeholder={t('form.pricing_per_guest_placeholder')}
                      min="0"
                      step="0.01"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1">{t('form.pricing_per_guest_description')}</p>
            </>
          ) : (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive font-medium">⚠️ Invalid room type selected</p>
              <p className="text-xs text-destructive/80 pt-1">The selected room type has invalid max occupancy (0 guests). Please select a different room type or update the room type settings.</p>
            </div>
          )}
        </section>
      )}
      
      {selectedRoomTypeId && pricingMethod === 'per_night' && (
        <section className="space-y-3 animate-in fade-in-50">
            <Label>{t('form.base_price_label')} <span className="text-destructive">*</span></Label>
            <div className="space-y-1 pt-1">
                <Label htmlFor="basePrice">Base Price ($)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder={t('form.base_price_placeholder')}
                  min="0"
                  step="0.01"
                  required={pricingMethod === 'per_night'}
                />
                 <p className="text-xs text-muted-foreground pt-1">{t('form.base_price_description')}</p>
            </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">Pricing Model</h3>
        <div className="flex items-center space-x-2 pt-1">
          <Checkbox 
            id="useBaseRateDerivation" 
            checked={useBaseRateDerivation} 
            onCheckedChange={(checked) => {
              setUseBaseRateDerivation(checked as boolean);
              if (!checked) {
                setCalculatedPrice(null);
                setBaseRates([]);
              }
            }} 
          />
          <Label htmlFor="useBaseRateDerivation" className="font-normal cursor-pointer">
            Use Base Rate Derivation (Recommended)
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, the price is calculated dynamically from a base rate + adjustments. Changes to the base rate automatically update all prices.
        </p>
      </section>

      {useBaseRateDerivation && selectedRoomTypeId && (
        <section className="space-y-3 animate-in fade-in-50 bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">Base Rate Derivation Settings</h3>
          
          {isLoadingBaseRates ? (
            <div className="flex items-center justify-center py-4">
              <Icons.Spinner className="h-5 w-5 animate-spin" />
              <span className="ml-2 text-sm">Loading base rates...</span>
            </div>
          ) : baseRates.length === 0 ? (
            <Alert variant="destructive" className="bg-yellow-50 text-yellow-800 border-yellow-200">
              <AlertDescription>
                No base rates found for this room type. Please create a base rate first in the pricing settings.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="baseRateSelect">Select Base Rate *</Label>
                <Select value={selectedBaseRateId} onValueChange={setSelectedBaseRateId}>
                  <SelectTrigger id="baseRateSelect">
                    <SelectValue placeholder="Choose a base rate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {baseRates.map(rate => (
                      <SelectItem key={rate.id} value={rate.id}>
                        ${rate.base_price.toFixed(2)} ({rate.start_date} {rate.end_date ? `to ${rate.end_date}` : 'Open-ended'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="adjustmentType">Adjustment Type *</Label>
                <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
                  <SelectTrigger id="adjustmentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Use base rate as-is)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Base + $X)</SelectItem>
                    <SelectItem value="percentage">Percentage (Base + X%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {adjustmentType !== 'none' && (
                <div className="space-y-1">
                  <Label htmlFor="adjustmentValue">
                    {adjustmentType === 'fixed' ? 'Adjustment Amount ($)' : 'Adjustment Percentage (%)'}
                  </Label>
                  <Input
                    id="adjustmentValue"
                    type="number"
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(e.target.value)}
                    placeholder={adjustmentType === 'fixed' ? 'e.g., 50' : 'e.g., 20'}
                    step={adjustmentType === 'fixed' ? '0.01' : '0.1'}
                  />
                </div>
              )}

              {calculatedPrice !== null && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800 font-semibold">
                    Calculated Price: ${calculatedPrice.toFixed(2)}
                    <span className="block text-xs text-green-700 mt-1">
                      This is the final price guests will see.
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.validity_period')}</h3>
         <div className="space-y-1">
          <Label htmlFor="dateRange">{t('form.date_range_label')} <span className="text-destructive">*</span></Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="dateRange" variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                <Icons.CalendarDays className="mr-2 h-4 w-4" />
                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}</> : (isOpenEnded ? <>{format(dateRange.from, "PPP")} - {t('form.open_ended')}</> : format(dateRange.from, "PPP"))) : <span>{t('form.date_range_placeholder')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleDateRangeChange} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
           <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="open-ended-checkbox" checked={isOpenEnded} onCheckedChange={(checked) => setIsOpenEnded(checked as boolean)} />
              <Label htmlFor="open-ended-checkbox" className="text-sm font-normal cursor-pointer">{t('form.open_ended_label')}</Label>
           </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.policy_settings')}</h3>
        <div className="space-y-1 pt-1">
          <Label htmlFor="cancellationPolicy">{t('form.cancellation_policy_label')}</Label>
          <Textarea id="cancellationPolicy" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} placeholder={t('form.cancellation_policy_placeholder')} />
        </div>
        <div className="flex items-start space-x-2 pt-2">
          <Checkbox id="isDefaultPlan" checked={isDefaultPlan} onCheckedChange={(checked) => setIsDefaultPlan(checked as boolean)} />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="isDefaultPlan" className="font-normal cursor-pointer">{t('form.default_plan_label')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('form.default_plan_description')}
            </p>
          </div>
        </div>
      </section>

      <DialogFooter className="pt-6">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>
            {t('buttons.cancel')}
          </Button></DialogClose>
        <Button type="submit" disabled={availableRoomTypes.length === 0 || !selectedRoomTypeId || maxGuestsForType === 0}>{t('buttons.save')}</Button>
      </DialogFooter>
    </form>
  );
}
