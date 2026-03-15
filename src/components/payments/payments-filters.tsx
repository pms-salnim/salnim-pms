
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";

interface PaymentsFiltersProps {
  onFilterChange: (filters: { 
    dateRange?: DateRange; 
    paymentStatus?: string; 
    paymentMethod?: string;
    searchTerm?: string;
  }) => void;
}

const statusKeys = ["paid", "pending", "refunded", "failed"];
const methodKeys = ["credit_card", "cash", "bank_transfer", "online_payment", "other"];


export default function PaymentsFilters({ onFilterChange }: PaymentsFiltersProps) {
  const { t, i18n } = useTranslation('pages/payments/list/content');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const locale = i18n.language === 'fr' ? fr : enUS;

  useEffect(() => {
    onFilterChange({ 
      dateRange, 
      paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
      paymentMethod: paymentMethod === "all" ? undefined : paymentMethod,
      searchTerm: searchTerm || undefined,
    });
  }, [dateRange, paymentStatus, paymentMethod, searchTerm, onFilterChange]);
  
  const setPresetDateRange = (preset: "today" | "this_month") => {
    const today = new Date();
    if (preset === "today") {
      setDateRange({ from: today, to: today });
    } else if (preset === "this_month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateRange({ from: startOfMonth, to: today });
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 items-end gap-4 p-4 border rounded-lg shadow-sm bg-card">
      {/* Date Range Picker */}
      <div className="flex flex-col space-y-1 w-full lg:col-span-2">
        <label htmlFor="paymentDateFilter" className="text-sm font-medium text-muted-foreground">{t('filters.date_range_label')}</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="paymentDateFilter"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <Icons.CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y", { locale })} -{" "}
                    {format(dateRange.to, "LLL dd, y", { locale })}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y", { locale })
                )
              ) : (
                <span>{t('filters.date_range_placeholder')}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
             <div className="flex flex-col space-y-1 border-b sm:border-b-0 sm:border-r p-2">
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetDateRange("today")}>{t('filters.today_button')}</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetDateRange("this_month")}>{t('filters.this_month_button')}</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange({from: subDays(new Date(), 6), to: new Date()})}>{t('filters.last_7_days_button')}</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setDateRange({from: subDays(new Date(), 29), to: new Date()})}>{t('filters.last_30_days_button')}</Button>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
              locale={locale}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col space-y-1 w-full">
        <label htmlFor="paymentSearchTerm" className="text-sm font-medium text-muted-foreground">{t('filters.search_label')}</label>
        <Input
          id="paymentSearchTerm"
          placeholder={t('filters.search_placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 w-full lg:col-span-1">
        <div className="flex flex-col space-y-1 w-full">
          <label htmlFor="paymentStatusFilter" className="text-sm font-medium text-muted-foreground">{t('filters.status_label')}</label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger id="paymentStatusFilter">
              <SelectValue placeholder={t('filters.status_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.all_statuses')}</SelectItem>
              {statusKeys.map((status) => (
                <SelectItem key={status} value={status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}>{t(`filters.statuses.${status}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col space-y-1 w-full">
          <label htmlFor="paymentMethodFilter" className="text-sm font-medium text-muted-foreground">{t('filters.method_label')}</label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger id="paymentMethodFilter">
              <SelectValue placeholder={t('filters.method_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.all_methods')}</SelectItem>
              {methodKeys.map((method) => (
                <SelectItem key={method} value={method.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}>{t(`filters.methods.${method}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
