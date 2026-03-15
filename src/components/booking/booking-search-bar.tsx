
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { Minus, Plus, Users, BedDouble, PersonStanding } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GuestSelection {
  adults: number;
  children: number;
  rooms: number;
}

interface BookingSearchBarProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  guests: GuestSelection;
  onGuestsChange: (guests: GuestSelection) => void;
  onSearch: () => void;
}

export default function BookingSearchBar({
  dateRange,
  onDateRangeChange,
  guests,
  onGuestsChange,
  onSearch,
}: BookingSearchBarProps) {
  const { t, i18n } = useTranslation('booking');
  const locale = i18n.language === 'fr' ? fr : enUS;

  const handleGuestCountChange = (field: keyof GuestSelection, delta: number) => {
    const newValue = guests[field] + delta;
    if (newValue >= (field === 'children' ? 0 : 1)) {
      onGuestsChange({ ...guests, [field]: newValue });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg shadow-sm bg-card">
      <div className="md:col-span-2">
        <Label htmlFor="date-range-picker" className="text-sm font-medium text-muted-foreground">{t('search_bar.date_range_label')}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date-range-picker"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal mt-1 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]",
                !dateRange && "text-muted-foreground"
              )}
            >
              <Icons.CalendarDays className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>{format(dateRange.from, "LLL dd, y", { locale })} - {format(dateRange.to, "LLL dd, y", { locale })}</>
                ) : (format(dateRange.from, "LLL dd, y", { locale }))
              ) : (<span>{t('search_bar.date_range_placeholder')}</span>)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              locale={locale}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">{t('search_bar.rooms_guests_label')}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal mt-1 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]"
            >
              <Users className="mr-2 h-4 w-4" />
              <span>{t('search_bar.rooms_guests_summary', { roomCount: guests.rooms, guestCount: guests.adults + guests.children })}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">{t('search_bar.popover.title')}</h4>
                <p className="text-sm text-muted-foreground">{t('search_bar.popover.description')}</p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="rooms-count" className="flex items-center"><BedDouble className="mr-2 h-4 w-4" /> {t('search_bar.popover.rooms')}</Label>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]" onClick={() => handleGuestCountChange('rooms', -1)}><Minus className="h-4 w-4" /></Button>
                        <span className="w-8 text-center">{guests.rooms}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]" onClick={() => handleGuestCountChange('rooms', 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="adults-count" className="flex items-center"><PersonStanding className="mr-2 h-4 w-4" /> {t('search_bar.popover.adults')}</Label>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]" onClick={() => handleGuestCountChange('adults', -1)}><Minus className="h-4 w-4" /></Button>
                        <span className="w-8 text-center">{guests.adults}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]" onClick={() => handleGuestCountChange('adults', 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="children-count" className="flex items-center"><PersonStanding className="mr-2 h-3 w-3" /> {t('search_bar.popover.children')}</Label>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]" onClick={() => handleGuestCountChange('children', -1)}><Minus className="h-4 w-4" /></Button>
                        <span className="w-8 text-center">{guests.children}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]" onClick={() => handleGuestCountChange('children', 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button onClick={onSearch} className="w-full h-10 bg-[var(--booking-primary)] text-white hover:bg-[var(--booking-primary-hover)]">
        <Icons.Search className="mr-2 h-4 w-4" /> {t('search_bar.update_button')}
      </Button>
    </div>
  );
}
