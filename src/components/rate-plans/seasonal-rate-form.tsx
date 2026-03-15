
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

import type { SeasonalRate } from '@/types/seasonalRate';
import type { RatePlan } from '@/types/ratePlan';
import type { RoomType } from '@/types/roomType';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

interface SeasonalRateFormProps {
  initialData: SeasonalRate | null;
  ratePlans: RatePlan[];
  roomTypes: RoomType[];
  seasonalRates: SeasonalRate[];
  onSave: (data: Omit<SeasonalRate, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onClose: () => void;
}

export default function SeasonalRateForm({ initialData, ratePlans, roomTypes, seasonalRates, onSave, onClose }: SeasonalRateFormProps) {
  const { t } = useTranslation('pages/rate-plans/seasonal/content');
  const [name, setName] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedRatePlanId, setSelectedRatePlanId] = useState('');
  const [pricingPerGuest, setPricingPerGuest] = useState<Record<string, string>>({});
  const [basePrice, setBasePrice] = useState<string>('');
  const [active, setActive] = useState(true);

  const selectedRatePlan = ratePlans.find(rp => rp.id === selectedRatePlanId);
  const selectedRoomType = roomTypes.find(rt => rt.id === selectedRatePlan?.roomTypeId);
  const maxGuestsForType = selectedRoomType?.maxGuests || 0;
  const guestCountKeys = Array.from({ length: maxGuestsForType }, (_, i) => String(i + 1));

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDateRange({ from: initialData.startDate, to: initialData.endDate });
      setSelectedRatePlanId(initialData.ratePlanId);
      setBasePrice(initialData.basePrice !== undefined ? String(initialData.basePrice) : '');
      setActive(initialData.active);
      const initialPricingStrings: Record<string, string> = {};
      if (initialData.pricingPerGuest) {
        Object.keys(initialData.pricingPerGuest).forEach(key => {
          const val = initialData.pricingPerGuest?.[key];
          if (val !== undefined) initialPricingStrings[key] = String(val);
        });
      }
      setPricingPerGuest(initialPricingStrings);
    } else {
      setName('');
      setDateRange(undefined);
      setSelectedRatePlanId('');
      setBasePrice('');
      setPricingPerGuest({});
      setActive(true);
    }
  }, [initialData]);

  const handlePricingChange = (guestCountKey: string, value: string) => {
    setPricingPerGuest(prev => ({ ...prev, [guestCountKey]: value }));
  };

  const checkForOverlap = (newStartDate: Date, newEndDate: Date, ratePlanId: string) => {
    return seasonalRates.some(rate => {
      if (rate.id === initialData?.id) return false; // Ignore self when editing
      if (rate.ratePlanId !== ratePlanId) return false;
      if (!rate.active) return false; // Ignore inactive rates for overlap check

      const existingStart = startOfDay(rate.startDate);
      const existingEnd = startOfDay(rate.endDate);
      const newStart = startOfDay(newStartDate);
      const newEnd = startOfDay(newEndDate);

      // Overlap if new range starts before existing ends AND new range ends after existing starts
      return newStart <= existingEnd && newEnd >= existingStart;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !dateRange?.from || !dateRange.to || !selectedRatePlanId) {
      toast({ title: t('toasts.validation_error_title'), description: t('toasts.validation_error_required_fields'), variant: "destructive" });
      return;
    }
    
    if (active && checkForOverlap(dateRange.from, dateRange.to, selectedRatePlanId)) {
      toast({ title: t('toasts.conflict_error_title'), description: t('toasts.conflict_error_description'), variant: "destructive" });
      return;
    }

    const hasBasePrice = selectedRatePlan?.pricingMethod === 'per_night' && basePrice.trim() !== '' && !isNaN(parseFloat(basePrice));
    const hasGuestPrice = selectedRatePlan?.pricingMethod === 'per_guest' && Object.values(pricingPerGuest).some(p => p.trim() !== '' && !isNaN(parseFloat(p)));

    if (!hasBasePrice && !hasGuestPrice) {
      toast({ title: t('toasts.validation_error_title'), description: t('toasts.validation_error_price_required'), variant: "destructive" });
      return;
    }
    
    const dataToSave: Partial<Omit<SeasonalRate, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>> = {
      name,
      startDate: dateRange.from,
      endDate: dateRange.to,
      ratePlanId: selectedRatePlanId,
      active: active,
    };

    if (hasBasePrice) {
      dataToSave.basePrice = parseFloat(basePrice);
    }
    
    if (hasGuestPrice) {
      const numericPricingPerGuest: Record<string, number> = {};
      for (const key in pricingPerGuest) {
          if (pricingPerGuest[key]?.trim() !== '') {
            const numValue = parseFloat(pricingPerGuest[key]);
            if (!isNaN(numValue)) {
              numericPricingPerGuest[key] = numValue;
            }
          }
      }
      if (Object.keys(numericPricingPerGuest).length > 0) {
        dataToSave.pricingPerGuest = numericPricingPerGuest;
      }
    }

    onSave(dataToSave as Omit<SeasonalRate, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-1">
        <Label htmlFor="seasonName">{t('form.season_name_label')} <span className="text-destructive">*</span></Label>
        <Input id="seasonName" value={name} onChange={e => setName(e.target.value)} required placeholder={t('form.season_name_placeholder')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dateRange">{t('form.date_range_label')} <span className="text-destructive">*</span></Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="dateRange" variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <Icons.CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "PP")} - {format(dateRange.to, "PP")}</> : format(dateRange.from, "PP")) : <span>{t('form.date_range_placeholder')}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ratePlan">{t('form.rate_plan_label')} <span className="text-destructive">*</span></Label>
        <Select value={selectedRatePlanId} onValueChange={setSelectedRatePlanId} required>
          <SelectTrigger id="ratePlan"><SelectValue placeholder={t('form.rate_plan_placeholder')} /></SelectTrigger>
          <SelectContent>
            {ratePlans.map(rp => <SelectItem key={rp.id} value={rp.id}>{rp.planName} ({roomTypes.find(rt => rt.id === rp.roomTypeId)?.name || 'N/A'})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      <Separator className="my-4" />
      
      {selectedRatePlan ? (
        <div className="animate-in fade-in-50">
          <h4 className="font-medium text-foreground mb-2">{t('form.pricing_override_title')}</h4>
          <p className="text-sm text-muted-foreground mb-3">
            {t('form.pricing_override_description', { pricingMethod: selectedRatePlan.pricingMethod === 'per_night' ? t('form.per_night') : t('form.per_guest') })}
          </p>
          
          {selectedRatePlan.pricingMethod === 'per_night' && (
             <div className="space-y-1">
                <Label htmlFor="basePrice">{t('form.override_per_night_label')} ($)</Label>
                <Input id="basePrice" type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder={t('form.override_per_night_placeholder')} min="0" step="0.01" />
              </div>
          )}

          {selectedRatePlan.pricingMethod === 'per_guest' && (
            <div className="space-y-2">
                <Label>{t('form.override_per_guest_label')} ($)</Label>
                {selectedRoomType ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {guestCountKeys.map(num => (
                        <div key={num} className="space-y-1">
                            <Label htmlFor={`price-${num}`} className="text-xs">{t('form.guests_label', { count: Number(num) })}</Label>
                            <Input id={`price-${num}`} type="number" value={pricingPerGuest[num] || ''} onChange={e => handlePricingChange(num, e.target.value)} placeholder={t('form.override_per_guest_placeholder')} min="0" step="0.01" />
                        </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">{t('form.select_rate_plan_prompt')}</p>
                )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">{t('form.select_rate_plan_prompt')}</p>
      )}

      <Separator className="my-4" />

       <div className="flex items-center space-x-2 pt-2">
        <Switch id="promoActive" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="promoActive">{t('form.active_label')}</Label>
      </div>
      
      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline">{t('buttons.cancel')}</Button></DialogClose>
        <Button type="submit">{t('buttons.save')}</Button>
      </DialogFooter>
    </form>
  );
}
