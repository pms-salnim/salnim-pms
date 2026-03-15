
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useTranslation } from 'react-i18next';

export default function GuestFilters() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const { t } = useTranslation('pages/guests/all/content');

  // Placeholder data for filters - replace with dynamic data from your backend/state
  const nationalities = ["American", "British", "Canadian", "German", "French", "Other"];
  const tags = ["VIP", "Repeat Guest", "Business", "Leisure", "Has Notes"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end gap-4 p-4 border rounded-lg shadow-sm bg-card">
      <Input
        placeholder={t('filters.search_placeholder')}
        className="w-full lg:col-span-2 xl:col-span-1"
      />
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('filters.nationality_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all_nationalities')}</SelectItem>
          {nationalities.map((nat) => (
            <SelectItem key={nat} value={nat.toLowerCase().replace(" ", "-")}>{nat}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('filters.tags_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all_tags')}</SelectItem>
           {tags.map((tag) => (
            <SelectItem key={tag} value={tag.toLowerCase().replace(" ", "-")}>{tag}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <div className="w-full">
         <Popover>
          <PopoverTrigger asChild>
            <Button
              id="guestDateFilter"
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
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>{t('filters.date_range_placeholder')}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

    </div>
  );
}
