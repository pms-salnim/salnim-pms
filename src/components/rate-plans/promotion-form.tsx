
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from '@/hooks/use-toast';

import type { Promotion, DiscountType } from '@/types/promotion';
import type { RatePlan } from '@/types/ratePlan';
import { useTranslation } from 'react-i18next';

interface PromotionFormProps {
  initialData: Promotion | null;
  ratePlans: RatePlan[];
  onSave: (data: Omit<Promotion, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export default function PromotionForm({ initialData, ratePlans, onSave, onClose }: PromotionFormProps) {
  const { t } = useTranslation('pages/rate-plans/promotions/content');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRatePlanIds, setSelectedRatePlanIds] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCoupon, setIsCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setSelectedRatePlanIds(initialData.ratePlanIds || []);
      setDiscountType(initialData.discountType);
      setDiscountValue(String(initialData.discountValue));
      
      // Convert dates - handle both Date objects and strings
      const startDate = initialData.startDate ? 
        (initialData.startDate instanceof Date ? initialData.startDate : new Date(initialData.startDate)) 
        : undefined;
      const endDate = initialData.endDate ? 
        (initialData.endDate instanceof Date ? initialData.endDate : new Date(initialData.endDate)) 
        : undefined;
      
      setDateRange({ from: startDate, to: endDate });
      // Use promotionType field to determine if it's a coupon
      setIsCoupon(initialData.promotionType === 'coupon');
      setCouponCode(initialData.couponCode || '');
      setUsageLimit(initialData.usageLimit !== null && initialData.usageLimit !== undefined ? String(initialData.usageLimit) : '');
      setActive(initialData.active);
    } else {
      setName('');
      setDescription('');
      setSelectedRatePlanIds([]);
      setDiscountType('percentage');
      setDiscountValue('');
      setDateRange(undefined);
      setIsCoupon(false);
      setCouponCode('');
      setUsageLimit('');
      setActive(true);
    }
  }, [initialData]);

  const handleRatePlanSelect = (planId: string) => {
    setSelectedRatePlanIds(prev =>
      prev.includes(planId)
        ? prev.filter(id => id !== planId)
        : [...prev, planId]
    );
  };

  const handleSelectAllRatePlans = () => {
    if (selectedRatePlanIds.length === ratePlans.length) {
      setSelectedRatePlanIds([]);
    } else {
      setSelectedRatePlanIds(ratePlans.map(plan => plan.id));
    }
  };

  // Group rate plans by room type
  const groupedRatePlans = ratePlans.reduce((acc: Record<string, any[]>, plan: any) => {
    const roomTypeName = plan.room_types?.name || 'Uncategorized';
    if (!acc[roomTypeName]) {
      acc[roomTypeName] = [];
    }
    acc[roomTypeName].push(plan);
    return acc;
  }, {});

  const sortedRoomTypes = Object.keys(groupedRatePlans).sort();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !discountValue || !dateRange?.from || !dateRange.to) {
      toast({ title: t('toasts.validation_error_title'), description: t('form.validation.required_fields'), variant: "destructive" });
      return;
    }
    if (isCoupon && !couponCode.trim()) {
        toast({ title: t('toasts.validation_error_title'), description: t('form.validation.coupon_required'), variant: "destructive" });
        return;
    }

    const promotionData = {
      name,
      description,
      ratePlanIds: selectedRatePlanIds,
      promotionType: isCoupon ? 'coupon' : 'automatic',
      discountType,
      discountValue: Number(discountValue),
      startDate: startOfDay(dateRange.from),
      endDate: startOfDay(dateRange.to),
      couponCode: isCoupon ? couponCode.trim().toUpperCase() : null,
      usageLimit: isCoupon && usageLimit ? Number(usageLimit) : null,
      timesUsed: initialData?.timesUsed || 0,
      active,
    };
    onSave(promotionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-1">
        <Label htmlFor="promoName">{t('form.name_label')} <span className="text-destructive">*</span></Label>
        <Input id="promoName" value={name} onChange={e => setName(e.target.value)} required placeholder={t('form.name_placeholder')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="promoDescription">{t('form.description_label')}</Label>
        <Textarea id="promoDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('form.description_placeholder')} />
      </div>
       <div className="space-y-2 pt-2">
          <Label>{t('form.type_label')} <span className="text-destructive">*</span></Label>
          <RadioGroup value={isCoupon ? 'coupon' : 'auto'} onValueChange={(v) => setIsCoupon(v === 'coupon')} className="flex gap-4 pt-1">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="auto" id="type_auto" />
              <Label htmlFor="type_auto" className="font-normal cursor-pointer">{t('form.type_auto')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="coupon" id="type_coupon" />
              <Label htmlFor="type_coupon" className="font-normal cursor-pointer">{t('form.type_coupon')}</Label>
            </div>
          </RadioGroup>
      </div>

      {isCoupon && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in-50">
           <div className="space-y-1">
              <Label htmlFor="couponCode">{t('form.coupon_code_label')} <span className="text-destructive">*</span></Label>
              <Input id="couponCode" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder={t('form.coupon_code_placeholder')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="usageLimit">{t('form.usage_limit_label')}</Label>
              <Input id="usageLimit" type="number" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} placeholder={t('form.usage_limit_placeholder')} min="1"/>
            </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('form.rate_plans_label')}</Label>
          <button
            type="button"
            onClick={handleSelectAllRatePlans}
            className="text-sm text-blue-600 hover:underline"
          >
            {selectedRatePlanIds.length === ratePlans.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <ScrollArea className="h-64 rounded-md border p-3">
          {ratePlans.length > 0 ? (
            <div className="space-y-4">
              {sortedRoomTypes.map(roomTypeName => (
                <div key={roomTypeName} className="space-y-2">
                  <h4 className="font-medium text-sm text-foreground sticky top-0 bg-background py-1 px-1">
                    {roomTypeName}
                  </h4>
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {groupedRatePlans[roomTypeName].map(plan => (
                      <div key={plan.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`rp-${plan.id}`}
                          checked={selectedRatePlanIds.includes(plan.id)}
                          onCheckedChange={() => handleRatePlanSelect(plan.id)}
                        />
                        <Label htmlFor={`rp-${plan.id}`} className="font-normal cursor-pointer text-sm">
                          {plan.planName}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No rate plans available</p>
          )}
        </ScrollArea>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('form.discount_type_label')} <span className="text-destructive">*</span></Label>
          <RadioGroup value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)} className="flex gap-4 pt-1">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="dt_percentage" />
              <Label htmlFor="dt_percentage" className="font-normal">{t('form.discount_type_percentage')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="flat_rate" id="dt_flat_rate" />
              <Label htmlFor="dt_flat_rate" className="font-normal">{t('form.discount_type_flat')}</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-1">
          <Label htmlFor="discountValue">{t('form.discount_value_label')} <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              id="discountValue"
              type="number"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              required
              min="0"
              placeholder={discountType === 'percentage' ? t('form.discount_value_percentage_placeholder') : t('form.discount_value_flat_placeholder')}
              className="pl-8"
            />
            <span className="absolute left-2.5 top-2.5 text-muted-foreground">
              {discountType === 'percentage' ? '%' : '$'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="dateRange">{t('form.validity_period_label')} <span className="text-destructive">*</span></Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button id="dateRange" variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
              <Icons.CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "PP")} - {format(dateRange.to, "PP")}</> : format(dateRange.from, "PP")) : <span>{t('form.validity_period_placeholder')}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
          </PopoverContent>
        </Popover>
      </div>
      
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
