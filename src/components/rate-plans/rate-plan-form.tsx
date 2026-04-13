
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
      
      setDateRange({
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
      setDateRange({ from: new Date(), to: undefined });
      setIsOpenEnded(true);
    }
  }, [initialData]);
  
  useEffect(() => {
    if (isOpenEnded) {
        setDateRange(prev => ({ from: prev?.from, to: undefined }));
    }
  }, [isOpenEnded]);

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
    
    // Validate room type has valid max occupancy
    if (!selectedRoomTypeId || maxGuestsForType === 0) {
      toast({ 
        title: t('toasts.validation_error_title'), 
        description: 'Please select a room type with valid occupancy (more than 0 guests)', 
        variant: "destructive" 
      });
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
        return;
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
    };
    
    onSave(ratePlanData as Omit<RatePlan, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>);
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
              <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
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
