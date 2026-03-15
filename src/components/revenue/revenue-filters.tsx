
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
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { useTranslation } from 'react-i18next';

interface RevenueFiltersProps {
  onApplyFilters: (filters: { 
    dateRange?: DateRange; 
    bookingSource?: string; 
    roomType?: string 
  }) => void;
  bookingSources: string[];
  roomTypes: string[];
}

export default function RevenueFilters({ onApplyFilters, bookingSources, roomTypes }: RevenueFiltersProps) {
  const { t, i18n } = useTranslation('pages/revenue/overview/content');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29), // Default to last 30 days
    to: new Date(),
  });
  const [bookingSource, setBookingSource] = useState<string>("all");
  const [roomType, setRoomType] = useState<string>("all");
  const locale = i18n.language === 'fr' ? fr : enUS;

  useEffect(() => {
    onApplyFilters({ 
      dateRange, 
      bookingSource: bookingSource,
      roomType: roomType 
    });
  }, [dateRange, bookingSource, roomType, onApplyFilters]);

  const setPresetDateRange = (preset: "today" | "this_week" | "this_month") => {
    const today = new Date();
    if (preset === "today") {
      setDateRange({ from: today, to: today });
    } else if (preset === "this_week") {
      setDateRange({ from: startOfWeek(today, { locale }), to: endOfWeek(today, { locale }) });
    } else if (preset === "this_month") {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      setDateRange({ from: start, to: end });
    }
  };


  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-end gap-4 p-4 border rounded-lg shadow-sm bg-card">
      {/* Date Range Picker */}
      <div className="flex flex-col space-y-1 w-full">
        <label htmlFor="revenueDateFilter" className="text-sm font-medium text-muted-foreground">{t('filters.date_range_label')}</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="revenueDateFilter"
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
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetDateRange("this_week")}>{t('filters.this_week_button')}</Button>
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
              numberOfMonths={1} // Can be 2 for wider view
              locale={locale}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Booking Source Filter */}
      <div className="flex flex-col space-y-1 w-full">
         <label htmlFor="bookingSourceFilter" className="text-sm font-medium text-muted-foreground">{t('filters.booking_source_label')}</label>
        <Select value={bookingSource} onValueChange={setBookingSource}>
          <SelectTrigger id="bookingSourceFilter" className="w-full">
            <SelectValue placeholder={t('filters.booking_source_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all_sources')}</SelectItem>
            {bookingSources.map((source) => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Room Type Filter */}
      <div className="flex flex-col space-y-1 w-full">
        <label htmlFor="roomTypeFilter" className="text-sm font-medium text-muted-foreground">{t('filters.room_type_label')}</label>
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger id="roomTypeFilter" className="w-full">
            <SelectValue placeholder={t('filters.room_type_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all_room_types')}</SelectItem>
            {roomTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
