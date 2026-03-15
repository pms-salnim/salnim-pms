
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { ReservationDisplayStatus } from "./reservation-status-badge";
import type { RoomType } from "@/types/roomType";
import { useTranslation } from 'react-i18next';

interface ReservationFiltersProps {
    roomTypes: RoomType[];
    statusFilter: ReservationDisplayStatus | 'all';
    onStatusFilterChange: (status: ReservationDisplayStatus | 'all') => void;
    roomTypeFilter: string;
    onRoomTypeFilterChange: (roomTypeId: string) => void;
    bookedDateRange: DateRange | undefined;
    onBookedDateRangeChange: (dateRange?: DateRange) => void;
    checkinDateRange: DateRange | undefined;
    onCheckinDateRangeChange: (dateRange?: DateRange) => void;
    checkoutDateRange: DateRange | undefined;
    onCheckoutDateRangeChange: (dateRange?: DateRange) => void;
    cancellationDateRange?: DateRange | undefined;
    onCancellationDateRangeChange?: (dateRange?: DateRange) => void;
    cancellationReason?: string;
    onCancellationReasonChange?: (reason: string) => void;
    bookingSource?: string;
    onBookingSourceChange?: (source: string) => void;
    paymentStatus?: string;
    onPaymentStatusChange?: (status: string) => void;
}

const statusOptions: (ReservationDisplayStatus | 'all')[] = ['all', 'Pending', 'Confirmed', 'Canceled', 'No-Show', 'Checked-in', 'Completed'];

export default function ReservationFilters({
    roomTypes,
    statusFilter,
    onStatusFilterChange,
    roomTypeFilter,
    onRoomTypeFilterChange,
    bookedDateRange,
    onBookedDateRangeChange,
    checkinDateRange,
    onCheckinDateRangeChange,
    checkoutDateRange,
    onCheckoutDateRangeChange,
    cancellationDateRange,
    onCancellationDateRangeChange,
    cancellationReason,
    onCancellationReasonChange,
    bookingSource,
    onBookingSourceChange,
    paymentStatus,
    onPaymentStatusChange,
}: ReservationFiltersProps) {
  const { t } = useTranslation(['pages/reservations/all/content', 'status/status_content']);

  const handleClearFilters = () => {
    onStatusFilterChange('all');
    onRoomTypeFilterChange('all');
    onBookedDateRangeChange(undefined);
    onCheckinDateRangeChange(undefined);
    onCheckoutDateRangeChange(undefined);
  }

  const applyQuickCheckinRange = (range: { from: Date; to: Date }) => {
    onCheckinDateRangeChange({ from: range.from, to: range.to });
  }

  const getRangeForKey = (key: string) => {
    const today = new Date();
    switch (key) {
      case 'today':
        return { from: startOfDay(today), to: endOfDay(today) };
      case 'this_week':
        return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'this_month':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'next_week': {
        const nextWeek = addDays(today, 7);
        return { from: startOfWeek(nextWeek, { weekStartsOn: 1 }), to: endOfWeek(nextWeek, { weekStartsOn: 1 }) };
      }
      case 'next_month': {
        const nextMonth = addDays(startOfMonth(today), 32);
        return { from: startOfMonth(nextMonth), to: endOfMonth(nextMonth) };
      }
      default:
        return null;
    }
  };

  const isSameRange = (rangeA?: DateRange, rangeB?: { from: Date; to: Date }) => {
    if (!rangeA || !rangeB) return false;
    const aFrom = rangeA.from && (rangeA.from as Date).getTime();
    const aTo = rangeA.to && (rangeA.to as Date).getTime();
    return aFrom === rangeB.from.getTime() && aTo === rangeB.to.getTime();
  }

  const DateRangeInput = ({ label, value, onChange }: { label: string, value: DateRange | undefined, onChange: (range?: DateRange) => void }) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Icons.CalendarDays className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>{format(value.from, "LLL dd, y")} - {format(value.to, "LLL dd, y")}</>
              ) : (
                format(value.from, "LLL dd, y")
              )
            ) : (
              <span>{t('filters.date_range_placeholder')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[640px] p-4" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Icons.Filter className="mr-2 h-4 w-4" />
          {t('filters.button_text')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[720px] p-4" align="end">
        <DropdownMenuLabel>{t('filters.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-4 p-2">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="statusFilter">{t('filters.status_label')}</Label>
              <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as ReservationDisplayStatus | 'all')}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder={t('filters.status_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(status => (
                      <SelectItem key={status} value={status}>
                          {status === 'all' 
                              ? t('filters.status_all') 
                              : t(`status/status_content:reservation.${status.toLowerCase().replace(/-/g, '_')}`)}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="roomTypeFilter">{t('filters.room_type_label')}</Label>
              <Select value={roomTypeFilter} onValueChange={onRoomTypeFilterChange}>
                <SelectTrigger id="roomTypeFilter">
                  <SelectValue placeholder={t('filters.room_type_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.room_type_all')}</SelectItem>
                  {roomTypes.map(rt => (
                      <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyQuickCheckinRange(getRangeForKey('today')!)}
                    className={cn("flex-1 px-3 py-2 text-sm rounded-md border", isSameRange(checkinDateRange, getRangeForKey('today')!) ? 'bg-accent text-accent-foreground' : 'bg-background')}
            >{t('filters.quick_today')}</button>
            <button
              type="button"
              onClick={() => applyQuickCheckinRange(getRangeForKey('this_week')!)}
                className={cn("flex-1 px-3 py-2 text-sm rounded-md border", isSameRange(checkinDateRange, getRangeForKey('this_week')!) ? 'bg-accent text-accent-foreground' : 'bg-background')}
            >{t('filters.quick_this_week')}</button>
            <button
              type="button"
              onClick={() => applyQuickCheckinRange(getRangeForKey('this_month')!)}
                className={cn("flex-1 px-3 py-2 text-sm rounded-md border", isSameRange(checkinDateRange, getRangeForKey('this_month')!) ? 'bg-accent text-accent-foreground' : 'bg-background')}
            >{t('filters.quick_this_month')}</button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyQuickCheckinRange(getRangeForKey('next_week')!)}
                className={cn("flex-1 px-3 py-2 text-sm rounded-md border", isSameRange(checkinDateRange, getRangeForKey('next_week')!) ? 'bg-accent text-accent-foreground' : 'bg-background')}
            >{t('filters.quick_next_week')}</button>
            <button
              type="button"
              onClick={() => applyQuickCheckinRange(getRangeForKey('next_month')!)}
                className={cn("flex-1 px-3 py-2 text-sm rounded-md border", isSameRange(checkinDateRange, getRangeForKey('next_month')!) ? 'bg-accent text-accent-foreground' : 'bg-background')}
            >{t('filters.quick_next_month')}</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DateRangeInput
              label={t('filters.date_booked_label')}
              value={bookedDateRange}
              onChange={onBookedDateRangeChange}
            />
            <DateRangeInput
              label={t('filters.check_in_date_label')}
              value={checkinDateRange}
              onChange={onCheckinDateRangeChange}
            />
            <DateRangeInput
              label={t('filters.check_out_date_label')}
              value={checkoutDateRange}
              onChange={onCheckoutDateRangeChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DateRangeInput
              label={t('filters.cancellation_date_label') || 'Cancellation Date'}
              value={cancellationDateRange}
              onChange={onCancellationDateRangeChange || (() => {})}
            />

            <div>
              <Label>{t('filters.cancellation_reason_label') || 'Cancellation Reason'}</Label>
              <Input value={cancellationReason || ''} onChange={(e) => onCancellationReasonChange?.(e.target.value)} placeholder={t('filters.cancellation_reason_placeholder') || 'e.g. Guest request'} />
            </div>

            <div>
              <Label>{t('filters.booking_source_label') || 'Booking Source'}</Label>
              <Select value={bookingSource || 'all'} onValueChange={(v) => onBookingSourceChange?.(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.source_all') || 'All'}</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="OTA">OTA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t('filters.payment_status_label') || 'Payment / Refund Status'}</Label>
              <Select value={paymentStatus || 'all'} onValueChange={(v) => onPaymentStatusChange?.(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.payment_status_all') || 'All'}</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="flex justify-end gap-2 p-2">
          <Button variant="ghost" onClick={handleClearFilters}>{t('filters.clear_button')}</Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
