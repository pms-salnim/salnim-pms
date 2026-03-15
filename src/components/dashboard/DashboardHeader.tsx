"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { useTranslation } from 'react-i18next';
import { UserPlus as LucideUserPlus } from 'lucide-react';

interface DashboardHeaderProps {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  onNewReservation: () => void;
}

const DateRangePicker = ({ dateRange, setDateRange }: { dateRange: DateRange | undefined, setDateRange: (range: DateRange | undefined) => void }) => {
    const { t, i18n } = useTranslation('pages/dashboard/content');
    const locale = i18n.language === 'fr' ? fr : enUS;
    
    const setPresetRange = (preset: 'today' | 'this_week' | 'this_month' | 'last_7_days' | 'last_30_days') => {
        const today = new Date();
        switch (preset) {
            case 'today':
                setDateRange({ from: startOfDay(today), to: endOfDay(today) });
                break;
            case 'this_week':
                setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
                break;
            case 'this_month':
                setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
                break;
            case 'last_7_days':
                setDateRange({ from: startOfDay(subDays(today, 6)), to: endOfDay(today) });
                break;
            case 'last_30_days':
                 setDateRange({ from: startOfDay(subDays(today, 29)), to: endOfDay(today) });
                break;
        }
    };
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-[300px] justify-start text-left font-normal",
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
                        <span>{t('date_range_picker.placeholder')}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
                <div className="flex flex-col space-y-1 border-b sm:border-b-0 sm:border-r p-2">
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("today")}>{t('date_range_picker.today')}</Button>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("this_week")}>{t('date_range_picker.this_week')}</Button>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("this_month")}>{t('date_range_picker.this_month')}</Button>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("last_7_days")}>{t('date_range_picker.last_7_days')}</Button>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("last_30_days")}>{t('date_range_picker.last_30_days')}</Button>
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
    );
};

export function DashboardHeader({ dateRange, setDateRange, onNewReservation }: DashboardHeaderProps) {
    const { t } = useTranslation('pages/dashboard/content');

    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-[#0b1b2b]">{t('title')}</h1>
                <p className="text-slate-500 mt-1">{t('description')}</p>
            </div>

            <div className="flex items-center gap-4">
                <div>
                    <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
                </div>

                <button onClick={onNewReservation} className="inline-flex items-center gap-2 bg-[#003166] text-white font-semibold px-4 py-2 rounded-lg shadow-sm hover:opacity-95 active:scale-95">
                    <LucideUserPlus size={16} />
                    {t('new_booking_button')}
                </button>
            </div>
        </div>
    );
}
