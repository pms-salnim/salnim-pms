
"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { addDays, differenceInDays, eachDayOfInterval, format, isEqual, isWithinInterval, parseISO, startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from "date-fns";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, Timestamp, updateDoc, serverTimestamp, type FieldValue, writeBatch } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

import type { RoomType } from '@/types/roomType';
import type { Room as FirestoreRoom } from '@/types/room';
import type { Reservation as FirestoreReservation, ReservationRoom } from '@/components/calendar/types';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import type { FirestoreUser } from '@/types/firestoreUser';
import type { Property } from '@/types/property';
import type { RatePlan } from '@/types/ratePlan';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';
import type { SeasonalRate } from '@/types/seasonalRate';
import { useTranslation } from 'react-i18next';
import { enUS, fr } from 'date-fns/locale';

const ReservationForm = dynamic(() => import('@/components/reservations/reservation-form'), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const ReservationDetailModal = dynamic(() => import('@/components/reservations/reservation-detail-modal'), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


const ItemTypes = {
  RESERVATION: 'reservation',
  RESERVATION_RESIZE_HANDLE: 'reservation_resize_handle'
};

interface UpdateDetails {
  oldReservation: FirestoreReservation;
  newValues: {
    startDate: Date;
    endDate: Date;
    roomId: string;
    roomName: string;
    roomTypeId: string;
    roomTypeName: string;
    ratePlanId?: string;
    ratePlanName?: string;
    totalPrice: number;
    roomsTotal: number;
    subtotal: number;
    extrasTotal: number;
    discountAmount: number;
    taxAmount: number;
    netAmount: number;
  };
}

const SelectionBar = ({ style }: { style: React.CSSProperties }) => (
    <div
      style={style}
      className="absolute top-1 bottom-1 bg-primary/20 border-2 border-dashed border-primary rounded-md z-10 pointer-events-none"
      data-ai-hint="selection placeholder"
    />
);


const DraggableReservationBar = ({ reservation, style, onClick, onReservationResize, dayWidthPx, onDragStart }: {
    reservation: FirestoreReservation & { uniqueDisplayId: string };
    style: React.CSSProperties;
    onClick: () => void;
    onReservationResize: (reservation: FirestoreReservation, newEndDate: Date) => void;
    dayWidthPx: number;
    onDragStart: (reservation: FirestoreReservation) => void;
}) => {
    const { t } = useTranslation('pages/calendar/calendar');
    const [{ isDragging }, drag, preview] = useDrag(() => ({
        type: ItemTypes.RESERVATION,
        item: reservation,
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    const [{ isResizing, currentOffset }, resizeDrag] = useDrag(() => ({
        type: ItemTypes.RESERVATION_RESIZE_HANDLE,
        item: { reservation },
        end: (item, monitor) => {
            const offset = monitor.getDifferenceFromInitialOffset();
            if (!offset || Math.abs(offset.x) < dayWidthPx / 2) return;

            const daysExtended = Math.round(offset.x / dayWidthPx);
            if (daysExtended === 0) return;

            const newEndDate = addDays(item.reservation.endDate, daysExtended);
            if (differenceInDays(newEndDate, item.reservation.startDate) < 1) {
                toast({ title: t('toasts.invalid_duration_title'), description: t('toasts.invalid_duration_description'), variant: "destructive" });
                return;
            }
            onReservationResize(item.reservation, newEndDate);
        },
        collect: (monitor) => ({
            isResizing: !!monitor.isDragging(),
            currentOffset: monitor.getDifferenceFromInitialOffset(),
        }),
    }));
    
    useEffect(() => {
        preview(getEmptyImage(), { captureDraggingState: true });
    }, [preview]);

    const extendedWidth = isResizing && currentOffset ? currentOffset.x : 0;
    
    const combinedStyle = {
        ...style,
        width: `calc(${style.width} + ${extendedWidth}px)`,
        opacity: isDragging ? 0.5 : 1,
        transition: isResizing ? 'none' : 'width 0.2s ease-out',
    };

    const solidColor = combinedStyle.backgroundColor as string;
    const transparentColor = solidColor ? `${solidColor}33` : 'rgba(0, 49, 102, 0.2)'; // 33 = 20% opacity in hex

    return (
        <div
            ref={drag}
            style={{
                ...combinedStyle,
                backgroundColor: transparentColor,
                borderLeft: `4px solid ${solidColor}`,
            }}
            className="absolute top-1 bottom-1 flex items-center p-2 rounded-md text-foreground font-medium cursor-pointer overflow-hidden shadow-lg transition-all hover:ring-2 hover:ring-primary/50 z-20"
            onClick={onClick}
            title={`${reservation.guestName} - ${format(reservation.startDate, 'PP')} to ${format(reservation.endDate, 'PP')}`}
            data-ai-hint="reservation event"
        >
            <span className="truncate text-xs font-semibold">{reservation.guestName || `Res ID: ${reservation.id?.substring(0, 6)}`}</span>
            <div 
                ref={resizeDrag} 
                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-30 group"
                onClick={(e) => e.stopPropagation()} // Prevent parent onClick
            >
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-0.5 h-4 bg-primary/50 rounded-full group-hover:bg-primary transition-colors" />
                </div>
            </div>
        </div>
    );
};


// --- Helper: Calendar Cell Display (for Available/Blocked status) ---
interface CalendarCellDisplayProps {
  status: 'Available' | 'Blocked';
  onMouseDown: () => void;
  onMouseEnter: () => void;
  price?: number;
  currency?: string;
}
const CalendarCellDisplay: React.FC<CalendarCellDisplayProps> = ({ status, onMouseDown, onMouseEnter, price, currency }) => {
  const cellClasses = cn(
    "h-12 border-r border-b border-border relative", // Base classes for the cell
    status === 'Available' && "bg-card hover:bg-green-100/50 dark:hover:bg-green-900/50 cursor-crosshair transition-colors",
    status === 'Blocked' && "bg-slate-200 dark:bg-slate-700 cursor-not-allowed"
  );
  
  return (
    <div 
      className={cellClasses} 
      onMouseDown={status === 'Available' ? onMouseDown : undefined} 
      onMouseEnter={status === 'Available' ? onMouseEnter : undefined}
    >
      {status === 'Available' && price !== undefined && (
        <div className="absolute  p-4 text-[10px] font-medium text-muted-foreground opacity-30">
          {currency}{price}
        </div>
      )}
    </div>
  );
};


// --- Helper: Room Row Display (for a single physical room) ---
interface RoomRowDisplayProps {
  room: FirestoreRoom;
  datesToDisplay: Date[];
  reservations: (FirestoreReservation & { uniqueDisplayId: string })[];
  availabilitySettings: AvailabilitySetting[];
  onBookedCellClick: (reservation: FirestoreReservation) => void;
  dayWidthPx: number;
  onReservationDrop: (draggedItem: FirestoreReservation, newRoom: FirestoreRoom, newStartDate: Date) => void;
  onReservationResize: (reservation: FirestoreReservation, newEndDate: Date) => void;
  onSelectionCreate: (room: FirestoreRoom, startDate: Date, endDate: Date) => void;
  allowSameDayTurnover: boolean;
  onReservationDragStart: (reservation: FirestoreReservation) => void;
  ratePlans: RatePlan[];
  roomTypes: RoomType[];
  currency?: string;
}
const RoomRowDisplay: React.FC<RoomRowDisplayProps> = ({ room, datesToDisplay, reservations, availabilitySettings, onBookedCellClick, dayWidthPx, onReservationDrop, onReservationResize, onSelectionCreate, allowSameDayTurnover, onReservationDragStart, ratePlans, roomTypes, currency }) => {
  const viewStartDate = datesToDisplay[0];
  const dropRef = React.useRef<HTMLDivElement>(null);
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: Date; end: Date } | null>(null);

  const [, drop] = useDrop(() => ({
      accept: ItemTypes.RESERVATION,
      drop: (item: FirestoreReservation, monitor) => {
          const gridRowDiv = dropRef.current;
          if (!gridRowDiv) return;

          const clientOffset = monitor.getClientOffset();
          if (!clientOffset) return;
          
          const dropX = clientOffset.x;
          const dateCellsStartX = gridRowDiv.getBoundingClientRect().left;
          const relativeX = dropX - dateCellsStartX;
          const dateIndex = Math.floor(relativeX / dayWidthPx);

          if (dateIndex >= 0 && dateIndex < datesToDisplay.length) {
              const newStartDate = datesToDisplay[dateIndex];
              onReservationDrop(item, room, newStartDate);
          }
      },
      collect: (monitor) => ({
          isOver: !!monitor.isOver(),
      }),
  }));
  
  const handleMouseDown = (date: Date) => {
    setIsSelecting(true);
    setSelectionRange({ start: date, end: date });
  };

  const handleMouseEnter = (date: Date) => {
    if (isSelecting) {
      setSelectionRange(prev => ({ ...prev!, end: date }));
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionRange) {
        const { start, end } = selectionRange;
        const finalStart = start < end ? start : end;
        const finalEnd = start < end ? end : start;
        onSelectionCreate(room, finalStart, finalEnd);
    }
    setIsSelecting(false);
    setSelectionRange(null);
  };
  
  const handleMouseLeave = () => {
    if(isSelecting) {
      handleMouseUp();
    }
  };


  return (
    <>
      {/* Room Name Column */}
      <div className="p-2 border-b border-r border-border font-normal text-sm sticky left-0 bg-card z-10 flex items-center h-12 min-w-[150px] max-w-[150px] truncate" title={room.name}>
        {room.name}
      </div>

      {/* Main Row Content: Background Grid + Absolutely Positioned Reservations */}
      <div
        ref={(node) => { drop(node); dropRef.current = node; }}
        className="relative border-b border-border"
        style={{ gridColumn: `2 / span ${datesToDisplay.length}` }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 1. Background Grid Cells */}
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${datesToDisplay.length}, minmax(${dayWidthPx}px, 1fr))` }}>
          {datesToDisplay.map((date) => {
            const dayStart = startOfDay(date);
            
            const isOccupiedDuringStay = reservations.some(res =>
              res.rooms.some(r => r.roomId === room.id) &&
              res.status !== 'Canceled' &&
              res.status !== 'No-Show' &&
              dayStart >= startOfDay(res.startDate) && dayStart < startOfDay(res.endDate)
            );

            if (isOccupiedDuringStay) {
              return <div key={date.toISOString()} className="h-12 border-r border-b border-border bg-card" />;
            }
            
            const isPendingCheckoutDay = reservations.some(res => 
              res.rooms.some(r => r.roomId === room.id) &&
              res.status !== 'Canceled' &&
              res.status !== 'No-Show' &&
              isEqual(dayStart, startOfDay(res.endDate)) &&
              !res.isCheckedOut &&
              !allowSameDayTurnover
            );
            
            const specificRoomSetting = availabilitySettings.find(setting =>
              setting.roomId === room.id &&
              setting.status === 'blocked' &&
              isWithinInterval(dayStart, { start: parseISO(setting.startDate), end: parseISO(setting.endDate) })
            );
            const roomTypeSetting = availabilitySettings.find(setting =>
              setting.roomTypeId === room.roomTypeId &&
              !setting.roomId &&
              setting.status === 'blocked' &&
              isWithinInterval(dayStart, { start: parseISO(setting.startDate), end: parseISO(setting.endDate) })
            );
            const isManuallyBlocked = specificRoomSetting || roomTypeSetting;

            const isCellBlocked = isPendingCheckoutDay || isManuallyBlocked;

            // Get default rate plan price for this room's type
            let defaultPrice: number | undefined;
            if (!isCellBlocked) {
              const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
              const defaultRatePlan = ratePlans.find(rp => rp.roomTypeId === room.roomTypeId && rp.default);
              
              if (defaultRatePlan) {
                if (defaultRatePlan.pricingMethod === 'per_night') {
                  defaultPrice = defaultRatePlan.basePrice ?? roomType?.baseRate;
                } else {
                  // For per_guest pricing, show price for 1 guest
                  defaultPrice = defaultRatePlan.pricingPerGuest?.['1'] ?? roomType?.baseRate;
                }
              } else if (roomType) {
                defaultPrice = roomType.baseRate;
              }
            }

            return (
              <CalendarCellDisplay
                key={date.toISOString()}
                status={isCellBlocked ? 'Blocked' : 'Available'}
                onMouseDown={() => handleMouseDown(date)}
                onMouseEnter={() => handleMouseEnter(date)}
                price={defaultPrice}
                currency={currency}
              />
            );
          })}
        </div>
        
        {isSelecting && selectionRange && (
            (() => {
                const start = selectionRange.start < selectionRange.end ? selectionRange.start : selectionRange.end;
                const end = selectionRange.start < selectionRange.end ? selectionRange.end : start;

                const startIndex = datesToDisplay.findIndex(d => isEqual(startOfDay(d), startOfDay(start)));
                const endIndex = datesToDisplay.findIndex(d => isEqual(startOfDay(d), startOfDay(end)));
                
                if (startIndex === -1 || endIndex === -1) return null;

                const left = startIndex * dayWidthPx;
                const width = (endIndex - startIndex + 1) * dayWidthPx;

                return <SelectionBar style={{ left: `${left}px`, width: `${width - 4}px` }} />;
            })()
        )}

        {/* 3. Absolutely Positioned Reservation Bars */}
        {reservations.filter(res => res.rooms.some(r => r.roomId === room.id) && res.status !== 'Canceled' && res.status !== 'No-Show').map(res => {
          const resStart = startOfDay(res.startDate);
          const resEnd = startOfDay(res.endDate);
          const viewEnd = startOfDay(datesToDisplay[datesToDisplay.length - 1]);

          if (resEnd < viewStartDate || resStart > viewEnd) return null;

          const effectiveStartDate = resStart < viewStartDate ? viewStartDate : resStart;
          
          const startOffsetDays = differenceInDays(effectiveStartDate, viewStartDate);
          if (startOffsetDays < 0) return null;
          
          const leftPositionPx = (startOffsetDays * dayWidthPx) + (dayWidthPx / 2);
          
          const visibleEndDateForCalc = resEnd > addDays(viewEnd, 1) ? addDays(viewEnd, 1) : resEnd;
          const visibleNights = differenceInDays(visibleEndDateForCalc, effectiveStartDate);

          let barWidthPx = visibleNights * dayWidthPx;
          
          const maxBarWidthPx = (datesToDisplay.length * dayWidthPx) - leftPositionPx;
          barWidthPx = Math.min(barWidthPx, maxBarWidthPx);
          
          const statusColors: Record<FirestoreReservation['status'], string> = {
            'Confirmed': '#16a34a',
            'Checked-in': '#3b82f6',
            'Completed': '#6b7280',
            'Pending': '#f97316',
            'Canceled': '#ef4444',
            'No-Show': '#964B00',
          };
          const backgroundColor = statusColors[res.status] || '#003166';
          
          const barStyle = {
              left: `${leftPositionPx}px`,
              width: `${barWidthPx - 4}px`, // a little padding
              backgroundColor: backgroundColor,
          };

          return (
             <DraggableReservationBar
                key={res.uniqueDisplayId}
                reservation={res}
                style={barStyle}
                onClick={() => onBookedCellClick(res)}
                onReservationResize={onReservationResize}
                dayWidthPx={dayWidthPx}
                onDragStart={onReservationDragStart}
             />
          );
        })}
      </div>
    </>
  );
};


// --- Main Calendar Grid Component ---
interface CalendarGridDisplayProps {
  viewStartDate: Date;
  viewModeInDays: number;
  roomTypes: RoomType[];
  rooms: FirestoreRoom[];
  reservations: (FirestoreReservation & { uniqueDisplayId: string })[];
  availabilitySettings: AvailabilitySetting[];
  onBookedCellClick: (reservation: FirestoreReservation) => void;
  onReservationDrop: (draggedItem: FirestoreReservation, newRoom: FirestoreRoom, newStartDate: Date) => void;
  onReservationResize: (reservation: FirestoreReservation, newEndDate: Date) => void;
  onSelectionCreate: (room: FirestoreRoom, startDate: Date, endDate: Date) => void;
  isLoadingGridData: boolean;
  allowSameDayTurnover: boolean;
  onStartDateChange: (date: Date) => void;
  onReservationDragStart: (reservation: FirestoreReservation) => void;
  ratePlans: RatePlan[];
  currency?: string;
}
const CalendarGridDisplay: React.FC<CalendarGridDisplayProps> = ({ 
    viewStartDate, 
    viewModeInDays, 
    roomTypes, 
    rooms, 
    reservations, 
    availabilitySettings, 
    onBookedCellClick, 
    onReservationDrop, 
    onReservationResize, 
    onSelectionCreate, 
    isLoadingGridData, 
    allowSameDayTurnover,
    ratePlans,
    currency,
    onStartDateChange,
    onReservationDragStart,
}) => {
  const { i18n } = useTranslation(['pages/calendar/calendar']);
  const { t } = useTranslation('pages/calendar/calendar');
  const locale = i18n.language === 'fr' ? fr : enUS;

  const datesToDisplay = useMemo(() => eachDayOfInterval({
    start: viewStartDate,
    end: addDays(viewStartDate, viewModeInDays - 1)
  }), [viewStartDate, viewModeInDays]);
  
  const DAY_WIDTH_PX = 80;


  if (isLoadingGridData) {
    return <div className="p-4 text-center text-muted-foreground flex items-center justify-center h-full"><Icons.Spinner className="mr-2 h-5 w-5 animate-spin" /> {t('loading')}</div>;
  }
  
  const handlePrevious = () => onStartDateChange(subDays(viewStartDate, 15));
  const handleNext = () => onStartDateChange(addDays(viewStartDate, 15));
  const handleToday = () => onStartDateChange(startOfDay(new Date()));
  const handleThisWeek = () => onStartDateChange(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const handleNextWeek = () => onStartDateChange(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));
  const handleThisMonth = () => onStartDateChange(startOfMonth(new Date()));
  const handleNextMonth = () => onStartDateChange(startOfMonth(addMonths(new Date(), 1)));
  const handlePreviousWeek = () => onStartDateChange(startOfWeek(subDays(viewStartDate, 7), { weekStartsOn: 1 }));
  const handleCurrentWeek = () => onStartDateChange(startOfWeek(viewStartDate, { weekStartsOn: 1 }));
  const handleNextWeekNav = () => onStartDateChange(startOfWeek(addDays(viewStartDate, 7), { weekStartsOn: 1 }));
  
  return (
    <div className="w-full h-full overflow-auto">
      <div className="grid relative" style={{ gridTemplateColumns: `150px repeat(${viewModeInDays}, minmax(${DAY_WIDTH_PX}px, 1fr))` }}>
        <div className="p-2 border-b border-r border-border font-semibold text-sm sticky left-0 top-0 bg-muted z-40 flex items-center justify-center gap-2 h-14 min-w-[150px] max-w-[150px]">
           {/* Quick Navigation Arrows */}
           <Button variant="ghost" size="icon" onClick={handlePreviousWeek} className="h-8 w-8" title={t('previous_week')}>
             <Icons.ChevronLeft className="h-4 w-4" />
           </Button>
           
           {/* Date Picker Popover */}
           <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title={t('date_picker')}>
                <Icons.CalendarDays className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {/* Quick Jump Options - 3 filters in first row, 2 in second row */}
              <div className="p-3 border-b">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{t('quick_jump')}</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleToday}>
                    <Icons.Calendar className="mr-1 h-3 w-3" />
                    {t('today')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleThisWeek}>
                    <Icons.CalendarDays className="mr-1 h-3 w-3" />
                    {t('this_week')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleThisMonth}>
                    <Icons.Calendar className="mr-1 h-3 w-3" />
                    {t('this_month')}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleNextWeek}>
                    <Icons.CalendarCheck className="mr-1 h-3 w-3" />
                    {t('next_week')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleNextMonth}>
                    <Icons.CalendarCheck className="mr-1 h-3 w-3" />
                    {t('next_month')}
                  </Button>
                </div>
              </div>

              {/* Navigation Arrows Row */}
              <div className="flex items-center justify-center gap-4 py-2 border-b">
                <Button variant="outline" size="icon" onClick={handlePrevious} className="h-8 w-8" title={t('previous_days')}>
                  <Icons.ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8" title={t('next_days')}>
                  <Icons.ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              
              {/* Calendar Picker - two months side by side, navigation arrows at top */}
              <ShadcnCalendar 
                mode="single" 
                selected={viewStartDate} 
                onSelect={(date) => date && onStartDateChange(date)} 
                initialFocus 
                numberOfMonths={2}
                pagedNavigation
              />
            </PopoverContent>
           </Popover>
           
           {/* Quick Navigation Arrows */}
           <Button variant="ghost" size="icon" onClick={handleNextWeekNav} className="h-8 w-8" title={t('next_week')}>
             <Icons.ChevronRight className="h-4 w-4" />
           </Button>
        </div>
        {datesToDisplay.map(date => (
          <div key={date.toISOString()} className="p-1 text-center border-b border-r border-border last:border-r-0 sticky top-0 bg-muted z-30 h-14 flex flex-col justify-center items-center">
            <div className="text-xs font-medium text-muted-foreground">{format(date, 'EEE', { locale })}</div>
            <div className="text-lg font-semibold">{format(date, 'd')}</div>
          </div>
        ))}

        {roomTypes.map(rt => {
          const roomsInThisType = rooms.filter(r => r.roomTypeId === rt.id).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
          return (
            <React.Fragment key={rt.id}>
              <div
                className="p-2 border-b border-r border-border font-semibold text-primary bg-primary/5 sticky left-0 z-10 h-12 flex items-center min-w-[150px] max-w-[150px] truncate"
                style={{ gridColumn: '1 / span 1' }}
                title={rt.name}
              >
                {rt.name}
              </div>
              <div className="border-b border-r border-border bg-primary/5 h-12" style={{ gridColumn: `2 / span ${viewModeInDays}` }} />

              {roomsInThisType.length > 0 ? (
                roomsInThisType.map(room => (
                  <RoomRowDisplay
                    key={room.id}
                    room={room}
                    datesToDisplay={datesToDisplay}
                    reservations={reservations}
                    availabilitySettings={availabilitySettings}
                    onBookedCellClick={onBookedCellClick}
                    dayWidthPx={DAY_WIDTH_PX}
                    onReservationDrop={onReservationDrop}
                    onReservationResize={onReservationResize}
                    onSelectionCreate={onSelectionCreate}
                    allowSameDayTurnover={allowSameDayTurnover}
                    onReservationDragStart={onReservationDragStart}
                    ratePlans={ratePlans}
                    roomTypes={roomTypes}
                    currency={currency}
                  />
                ))
              ) : (
                <>
                  <div className="p-2 border-b border-r border-border text-xs text-muted-foreground italic sticky left-0 bg-card z-10 h-12 min-w-[150px] max-w-[150px] truncate flex items-center justify-center">
                    ({t('no_rooms')})
                  </div>
                  {Array.from({ length: viewModeInDays }).map((_, idx) => (
                     <div key={`empty-cell-${rt.id}-${idx}`} className="border-b border-r border-border h-12" />
                  ))}
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const isRoomAvailableForUpdate = (
    roomId: string,
    range: { from: Date; to: Date },
    allReservations: FirestoreReservation[],
    movingReservationId: string,
    allowSameDayTurnover: boolean,
): boolean => {
    if (!range.from || !range.to) return false;
    const newFrom = startOfDay(range.from);
    const newTo = startOfDay(range.to);

    if (newFrom >= newTo) return false;

    const hasConflict = allReservations.some(res => {
        if (res.id === movingReservationId) return false;
        if (!res.rooms.some(r => r.roomId === roomId)) return false;
        if (res.status === 'Canceled' || res.status === 'No-Show') return false;

        const existingFrom = startOfDay(res.startDate);
        const existingTo = startOfDay(res.endDate);
        
        const isStandardOverlap = newFrom < existingTo && newTo > existingFrom;
        
        if (!allowSameDayTurnover) {
            const isCheckoutDayConflict = isEqual(newFrom, existingTo) && !res.isCheckedOut;
            const isCheckinDayConflict = isEqual(newTo, existingFrom);
            return isStandardOverlap || isCheckoutDayConflict || isCheckinDayConflict;
        }

        return isStandardOverlap;
    });

    return !hasConflict;
};

// --- Main Page Component ---
export default function CalendarPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation(['pages/calendar/calendar', 'pages/dashboard/reservation-form']);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);

  const [viewStartDate, setViewStartDate] = useState<Date>(startOfDay(new Date()));
  const viewModeInDays = 30; // Hardcoded to 30 days

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [allReservations, setAllReservations] = useState<FirestoreReservation[]>([]);
  const [allRatePlans, setAllRatePlans] = useState<RatePlan[]>([]);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySetting[]>([]);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>([]);
  
  const [isLoadingRoomTypes, setIsLoadingRoomTypes] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [isLoadingAvailabilitySettings, setIsLoadingAvailabilitySettings] = useState(true);
  const [isLoadingRatePlans, setIsLoadingRatePlans] = useState(true);
  const [isLoadingSeasonalRates, setIsLoadingSeasonalRates] = useState(true);
  const isGridDataLoading = isLoadingRoomTypes || isLoadingRooms || isLoadingReservations || isLoadingAvailabilitySettings || isLoadingRatePlans || isLoadingSeasonalRates;

  const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);
  const [isViewReservationModalOpen, setIsViewReservationModalOpen] = useState(false);
  const [prefillReservationData, setPrefillReservationData] = useState<Partial<FirestoreReservation> | null>(null);
  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<FirestoreReservation | null>(null);
  
  const [updateDetails, setUpdateDetails] = useState<UpdateDetails | null>(null);
  const [isConfirmingUpdate, setIsConfirmingUpdate] = useState(false);
  const canManageReservations = useMemo(() => user?.permissions?.reservations, [user]);

  const [draggedReservation, setDraggedReservation] = useState<FirestoreReservation | null>(null);


  useEffect(() => {
    if (user?.id) {
      const staffDocRef = doc(db, "staff", user.id);
      const unsubStaff = onSnapshot(staffDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const staffData = docSnap.data() as FirestoreUser;
          setPropertyId(staffData.propertyId);
        } else {
          setPropertyId(null);
        }
      });
      return () => unsubStaff();
    }
  }, [user?.id]);

  useEffect(() => {
    if (propertyId) {
      const propDocRef = doc(db, "properties", propertyId);
      const unsubProp = onSnapshot(propDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setPropertySettings(docSnap.data() as Property);
        } else {
          setPropertySettings(null);
        }
      });
      return () => unsubProp();
    }
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setRoomTypes([]); setRooms([]); setAllReservations([]); setAvailabilitySettings([]); setAllRatePlans([]); setSeasonalRates([]);
      setIsLoadingRoomTypes(true); setIsLoadingRooms(true); setIsLoadingReservations(true); setIsLoadingAvailabilitySettings(true); setIsLoadingRatePlans(true); setIsLoadingSeasonalRates(true);
      return;
    }
    
    setIsLoadingRoomTypes(true);
    const rtUnsub = onSnapshot(query(collection(db, "roomTypes"), where("propertyId", "==", propertyId)), (snap) => {
      setRoomTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
      setIsLoadingRoomTypes(false);
    }, (err) => { console.error("RT Fetch Error:", err); setIsLoadingRoomTypes(false); });

    setIsLoadingRooms(true);
    const rUnsub = onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", propertyId)), (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreRoom)));
      setIsLoadingRooms(false);
    }, (err) => { console.error("Rooms Fetch Error:", err); setIsLoadingRooms(false); });

    setIsLoadingReservations(true);
    const resUnsub = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId)), (snap) => {
      setAllReservations(snap.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          id: d.id, 
          startDate: (data.startDate as Timestamp).toDate(), 
          endDate: (data.endDate as Timestamp).toDate(),
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
          actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
          actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
          isCheckedOut: data.isCheckedOut || false,
        } as FirestoreReservation;
      }));
      setIsLoadingReservations(false);
    }, (err) => { console.error("Res Fetch Error:", err); setIsLoadingReservations(false); });
    
    setIsLoadingAvailabilitySettings(true);
    const availUnsub = onSnapshot(query(collection(db, "availability"), where("propertyId", "==", propertyId)), (snap) => {
      setAvailabilitySettings(snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          startDate: data.startDate,
          endDate: data.endDate,
        } as AvailabilitySetting;
      }));
      setIsLoadingAvailabilitySettings(false);
    }, (err) => { console.error("Availability Settings Fetch Error:", err); setIsLoadingAvailabilitySettings(false);});
    
    setIsLoadingRatePlans(true);
    const rpUnsub = onSnapshot(query(collection(db, "ratePlans"), where("propertyId", "==", propertyId)), (snap) => {
        setAllRatePlans(snap.docs.map(d => ({id: d.id, ...d.data() } as RatePlan)));
        setIsLoadingRatePlans(false);
    }, (err) => { setIsLoadingRatePlans(false); console.error("Error fetching rate plans:", err);});

    setIsLoadingSeasonalRates(true);
    const srUnsub = onSnapshot(query(collection(db, "seasonalRates"), where("propertyId", "==", propertyId), where("active", "==", true)), (snap) => {
        setSeasonalRates(snap.docs.map(d => ({...d.data(), id: d.id, startDate: (d.data().startDate as Timestamp).toDate(), endDate: (d.data().endDate as Timestamp).toDate()} as SeasonalRate)));
        setIsLoadingSeasonalRates(false);
    }, (err) => { setIsLoadingSeasonalRates(false); console.error("Error fetching seasonal rates:", err);});


    return () => { rtUnsub(); rUnsub(); resUnsub(); availUnsub(); rpUnsub(); srUnsub(); };
  }, [propertyId]);
  
 const handleSelectionCreate = useCallback((room: FirestoreRoom, startDate: Date, endDate: Date) => {
    const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
    if (!room || !roomType) {
        toast({ title: t('toasts.data_missing_title'), description: t('toasts.data_missing_description'), variant: "destructive" });
        return;
    }

    const availableRatePlans = allRatePlans.filter(rp => rp.roomTypeId === room.roomTypeId);
    const defaultPlan = availableRatePlans.find(rp => rp.default) || availableRatePlans[0];

    const newReservationRoom: ReservationRoom = {
      roomId: room.id,
      roomName: room.name,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      ratePlanId: defaultPlan?.id || '',
      ratePlanName: defaultPlan?.planName || '',
      price: 0, 
      adults: 1, // Will be updated by form
      children: 0,
      pricingMode: 'rate_plan',
    };
    
    setPrefillReservationData({
      rooms: [newReservationRoom],
      startDate: startDate,
      endDate: endDate,
      status: 'Pending',
    });
    setIsNewReservationModalOpen(true);
  }, [roomTypes, allRatePlans, t]);

  const handleBookedCellClick = (reservation: FirestoreReservation) => {
    setSelectedReservationForDetail(reservation);
    setIsViewReservationModalOpen(true);
  };
  
  const handleEditFromDetailModal = (reservation: FirestoreReservation) => {
    setIsViewReservationModalOpen(false); // Close detail modal first
    setSelectedReservationForDetail(null);
    setPrefillReservationData(reservation); // Then set data for edit modal
    setIsNewReservationModalOpen(true); // And open it
  };

  const handleReservationResize = useCallback((reservation: FirestoreReservation, newEndDate: Date) => {
    if (isEqual(startOfDay(reservation.endDate), startOfDay(newEndDate))) return;
  
    const isAvailable = isRoomAvailableForUpdate(
      reservation.rooms[0].roomId,
      { from: reservation.startDate, to: newEndDate },
      allReservations,
      reservation.id,
      propertySettings?.bookingPageSettings?.allowSameDayTurnover || false
    );
  
    if (!isAvailable) {
      toast({
        title: t('toasts.conflict_title'),
        description: t('toasts.conflict_resize_description', { roomName: reservation.rooms[0].roomName }),
        variant: "destructive",
      });
      return;
    }
  
    const oldNights = differenceInDays(reservation.endDate, reservation.startDate);
    const newNights = differenceInDays(newEndDate, reservation.startDate);
    
    const roomPricePerNight = (oldNights > 0 && reservation.roomsTotal) ? reservation.roomsTotal / oldNights : 0;
  
    const newRoomsTotal = roomPricePerNight * newNights;
    const extrasTotal = reservation.extrasTotal || 0;
    const newSubtotal = newRoomsTotal + extrasTotal;
  
    let newDiscountAmount = 0;
    const promotion = reservation.promotionApplied as any;
    if (promotion) {
      if (promotion.discountType === 'percentage') {
        newDiscountAmount = newSubtotal * (promotion.discountValue / 100);
      } else { // flat_rate
        newDiscountAmount = (promotion.discountValue || 0) * newNights;
      }
    }
  
    const newNetAmount = newSubtotal - newDiscountAmount;
  
    const taxEnabled = propertySettings?.taxSettings?.enabled ?? false;
    const taxRate = taxEnabled ? (propertySettings?.taxSettings?.rate || 0) / 100 : 0;
    const newTaxAmount = taxEnabled ? newNetAmount * taxRate : 0;
    const newTotalPrice = newNetAmount + newTaxAmount;
  
    const newValues: UpdateDetails['newValues'] = {
      startDate: reservation.startDate,
      endDate: newEndDate,
      roomId: reservation.rooms[0].roomId,
      roomName: reservation.rooms[0].roomName,
      roomTypeId: reservation.rooms[0].roomTypeId,
      roomTypeName: reservation.rooms[0].roomTypeName,
      ratePlanId: reservation.rooms[0].ratePlanId,
      ratePlanName: reservation.rooms[0].ratePlanName,
      totalPrice: newTotalPrice,
      roomsTotal: newRoomsTotal,
      subtotal: newSubtotal,
      extrasTotal: extrasTotal,
      discountAmount: newDiscountAmount,
      taxAmount: newTaxAmount,
      netAmount: newNetAmount,
    };
  
    setUpdateDetails({ oldReservation: reservation, newValues });
  }, [allReservations, propertySettings, t]);


 const handleReservationDrop = useCallback((draggedItem: FirestoreReservation, newRoom: FirestoreRoom, newStartDate: Date) => {
    const reservationToMove = allReservations.find(res => res.id === draggedItem.id);
    if (!reservationToMove) {
        toast({ title: t('toasts.error_title'), description: t('toasts.reservation_not_found_error'), variant: "destructive" });
        return;
    }
    
    const duration = differenceInDays(reservationToMove.endDate, reservationToMove.startDate);
    const newEndDate = addDays(newStartDate, duration);

    if (reservationToMove.rooms.some(r => r.roomId === newRoom.id) && isEqual(startOfDay(reservationToMove.startDate), startOfDay(newStartDate))) {
        return; // Dropped in the same place
    }
    
    const newRoomType = roomTypes.find(rt => rt.id === newRoom.roomTypeId);
    if (!newRoomType) {
        toast({ title: t('toasts.error_title'), description: t('toasts.missing_room_type_data'), variant: "destructive" });
        return;
    }

    const totalGuests = (reservationToMove.rooms[0]?.adults || 0) + (reservationToMove.rooms[0]?.children || 0);
    if (totalGuests > newRoomType.maxGuests) {
        toast({
            title: t('toasts.guest_count_high_title'),
            description: t('toasts.guest_count_high_description', { roomTypeName: newRoomType.name, maxGuests: newRoomType.maxGuests, guestCount: totalGuests }),
            variant: "destructive",
            duration: 7000,
        });
        return;
    }
    
    const nights = duration;
    
    let newRoomsTotal = reservationToMove.roomsTotal || 0;
    const roomPricePerNight = nights > 0 ? newRoomsTotal / nights : 0;
    
    if (reservationToMove.rooms[0].roomTypeId !== newRoom.roomTypeId) {
        // Find a suitable rate plan for the new room type
        const ratePlanForNewType = allRatePlans.find(rp => rp.default && rp.roomTypeId === newRoom.roomTypeId) || allRatePlans.find(rp => rp.roomTypeId === newRoom.roomTypeId);
        
        let newRoomPricePerNight = 0;
        if (ratePlanForNewType) {
            if(ratePlanForNewType.pricingMethod === 'per_night') {
                newRoomPricePerNight = ratePlanForNewType.basePrice || 0;
            } else {
                 const guestsKey = String(reservationToMove.rooms[0].adults || 1);
                 newRoomPricePerNight = ratePlanForNewType.pricingPerGuest?.[guestsKey] || ratePlanForNewType.pricingPerGuest?.['1'] || 0;
            }
        }
        newRoomsTotal = newRoomPricePerNight * nights;
    } else {
        newRoomsTotal = roomPricePerNight * nights;
    }

    const extrasTotal = reservationToMove.extrasTotal || 0;
    const newSubtotal = newRoomsTotal + extrasTotal;
  
    let newDiscountAmount = 0;
    const promotion = reservationToMove.promotionApplied as any;
    if (promotion) {
        if (promotion.discountType === 'percentage') {
            newDiscountAmount = newSubtotal * (promotion.discountValue / 100);
        } else { // flat_rate
            newDiscountAmount = (promotion.discountValue || 0) * nights;
        }
    }
  
    const newNetAmount = newSubtotal - newDiscountAmount;
  
    const taxEnabled = propertySettings?.taxSettings?.enabled ?? false;
    const taxRate = taxEnabled ? (propertySettings?.taxSettings?.rate || 0) / 100 : 0;
    const newTaxAmount = taxEnabled ? newNetAmount * taxRate : 0;
    const newTotalPrice = newNetAmount + newTaxAmount;

    const newValues: UpdateDetails['newValues'] = {
        startDate: newStartDate,
        endDate: newEndDate,
        roomId: newRoom.id,
        roomName: newRoom.name,
        roomTypeId: newRoom.roomTypeId,
        roomTypeName: newRoomType.name,
        ratePlanId: reservationToMove.rooms[0].ratePlanId,
        ratePlanName: reservationToMove.rooms[0].ratePlanName,
        totalPrice: newTotalPrice,
        roomsTotal: newRoomsTotal,
        subtotal: newSubtotal,
        extrasTotal: extrasTotal,
        discountAmount: newDiscountAmount,
        taxAmount: newTaxAmount,
        netAmount: newNetAmount,
    };
    
    setUpdateDetails({
        oldReservation: reservationToMove,
        newValues,
    });
}, [allReservations, roomTypes, propertySettings, allRatePlans, t]);


  const handleConfirmUpdate = async () => {
    if (!updateDetails || !propertyId) return;

    setIsConfirmingUpdate(true);
    const { oldReservation, newValues } = updateDetails;

    const isAvailable = isRoomAvailableForUpdate(
        newValues.roomId,
        { from: newValues.startDate, to: newValues.endDate },
        allReservations,
        oldReservation.id,
        propertySettings?.bookingPageSettings?.allowSameDayTurnover || false
    );

    if (!isAvailable) {
        toast({
            title: t('toasts.conflict_title'),
            description: t('toasts.conflict_move_description', { roomName: newValues.roomName }),
            variant: "destructive",
        });
        setIsConfirmingUpdate(false);
        setUpdateDetails(null);
        return;
    }

    try {
        const resDocRef = doc(db, "reservations", oldReservation.id);
        const dataToUpdate: Partial<FirestoreReservation> & { updatedAt: FieldValue } = {
            startDate: Timestamp.fromDate(newValues.startDate),
            endDate: Timestamp.fromDate(newValues.endDate),
            // Assuming single room edit for now from calendar
            rooms: [{
                ...oldReservation.rooms[0],
                roomId: newValues.roomId,
                roomName: newValues.roomName,
                roomTypeId: newValues.roomTypeId,
                roomTypeName: newValues.roomTypeName,
                ratePlanId: newValues.ratePlanId || oldReservation.rooms[0].ratePlanId,
                ratePlanName: newValues.ratePlanName || oldReservation.rooms[0].ratePlanName,
                pricingMode: 'rate_plan', // Reset to rate plan after move
            }],
            updatedAt: serverTimestamp(),
            totalPrice: newValues.totalPrice,
            roomsTotal: newValues.roomsTotal,
            subtotal: newValues.subtotal,
            extrasTotal: newValues.extrasTotal,
            discountAmount: newValues.discountAmount,
            taxAmount: newValues.taxAmount,
            netAmount: newValues.netAmount,
        };
        
        await updateDoc(resDocRef, dataToUpdate as any);
        
        toast({ title: t('toasts.success_title'), description: t('toasts.update_success_description') });

        const updatedReservation = {
          ...oldReservation,
          ...newValues,
          startDate: newValues.startDate,
          endDate: newValues.endDate,
          rooms: dataToUpdate.rooms as ReservationRoom[],
        };

        setAllReservations(prev => prev.map(res => 
            res.id === oldReservation.id 
            ? updatedReservation
            : res
        ));
        
        if (draggedReservation && draggedReservation.id === oldReservation.id) {
          setDraggedReservation(updatedReservation);
        }

    } catch (error) {
        console.error("Error updating reservation:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.update_error_description'), variant: "destructive" });
    } finally {
        setIsConfirmingUpdate(false);
        setUpdateDetails(null);
    }
  };

  const handleCheckIn = async (reservationId: string) => {
    if (!propertyId || !canManageReservations) return;
    try {
      await updateDoc(doc(db, "reservations", reservationId), { 
        status: 'Checked-in',
        actualCheckInTime: serverTimestamp(), 
        isCheckedOut: false 
      });
      toast({title: t('toasts.success_title'), description: t('toasts.check_in_success')});
    } catch(err) {
      toast({title: t('toasts.error_title'), description: t('toasts.check_in_error'), variant: "destructive"});
    }
  };

  const handleCheckOut = async (reservation: FirestoreReservation) => {
    if (!propertyId || !reservation.rooms[0].roomId || !canManageReservations || !user) return;
    try {
      const roomDetails = rooms.find(r => r.id === reservation.rooms[0].roomId);

      const batch = writeBatch(db);
      
      batch.update(doc(db, "reservations", reservation.id), { 
        status: 'Completed',
        actualCheckOutTime: serverTimestamp(), 
        isCheckedOut: true 
      });
      
      batch.update(doc(db, "rooms", reservation.rooms[0].roomId), { status: 'Dirty' });

      const newTaskRef = doc(collection(db, 'tasks'));
      const taskPayload = {
          id: newTaskRef.id,
          title: `Clean Room: ${reservation.rooms[0].roomName}`,
          description: `Standard checkout cleaning for room ${reservation.rooms[0].roomName} (${reservation.rooms[0].roomTypeName}). Guest: ${reservation.guestName}.`,
          property_id: propertyId,
          room_id: reservation.rooms[0].roomId,
          roomName: reservation.rooms[0].roomName,
          roomTypeName: reservation.rooms[0].roomTypeName,
          floor: roomDetails?.floor || 'N/A',
          assigned_to_role: 'housekeeping',
          assigned_to_uid: null,
          priority: 'High',
          status: 'Open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByName: user?.name || 'System',
          createdByUid: user?.id || 'system',
      };
      batch.set(newTaskRef, taskPayload);

      await batch.commit();
      toast({title: t('toasts.success_title'), description: t('toasts.check_out_success', { roomName: reservation.rooms[0].roomName || '' })});
    } catch(err) {
      console.error("Error checking out:", err);
      toast({title: t('toasts.error_title'), description: t('toasts.check_out_error'), variant: "destructive"});
    }
  };
  
  const flattenedReservations = allReservations.flatMap(res => 
    (res.rooms || []).map(room => ({
        ...res,
        uniqueDisplayId: `${res.id}-${room.roomId}`, 
    }))
  ).filter((value, index, self) => 
    index === self.findIndex((t) => (
      t.uniqueDisplayId === value.uniqueDisplayId
    ))
  );


  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.availability) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied_title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied_description')}
        </AlertDescription>
      </Alert>
    );
  }
  
  

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full w-full">
        {isGridDataLoading && roomTypes.length === 0 ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              <Icons.Spinner className="mr-2 h-6 w-6 animate-spin" /> {t('loading')}
            </div>
        ) : roomTypes.length > 0 ? (
            <CalendarGridDisplay
              viewStartDate={viewStartDate}
              viewModeInDays={viewModeInDays}
              roomTypes={roomTypes}
              rooms={rooms}
              reservations={flattenedReservations}
              availabilitySettings={availabilitySettings}
              onBookedCellClick={handleBookedCellClick}
              onReservationDrop={handleReservationDrop}
              onReservationResize={handleReservationResize}
              onSelectionCreate={handleSelectionCreate}
              isLoadingGridData={isGridDataLoading}
              allowSameDayTurnover={propertySettings?.bookingPageSettings?.allowSameDayTurnover || false}
              ratePlans={allRatePlans}
              currency={propertySettings?.currency}
              onStartDateChange={setViewStartDate}
              onReservationDragStart={setDraggedReservation}
            />
        ) : (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            <p>{t('no_room_types')}</p>
          </div>
        )}
        
        <Dialog open={isNewReservationModalOpen} onOpenChange={(isOpen) => { setIsNewReservationModalOpen(isOpen); if (!isOpen) setPrefillReservationData(null); }}>
          <DialogContent className="sm:max-w-5xl p-0 h-[90vh] flex flex-col">
              <DialogHeader className="px-6 pt-6">
                  <DialogTitle>{prefillReservationData?.id ? t('pages/dashboard/reservation-form:edit_title') : t('pages/dashboard/reservation-form:create_title')}</DialogTitle>
                  <DialogDescription>{prefillReservationData?.id ? t('pages/dashboard/reservation-form:edit_description') : t('pages/dashboard/reservation-form:create_description')}</DialogDescription>
              </DialogHeader>
              <ReservationForm
                onClose={() => { setIsNewReservationModalOpen(false); setPrefillReservationData(null); }}
                initialData={prefillReservationData as FirestoreReservation | null}
              />
          </DialogContent>
        </Dialog>

        {selectedReservationForDetail && (
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin"/></div>}>
            <ReservationDetailModal
              isOpen={isViewReservationModalOpen}
              onClose={() => { setIsViewReservationModalOpen(false); setSelectedReservationForDetail(null); }}
              initialData={selectedReservationForDetail}
              propertySettings={propertySettings}
              onEdit={handleEditFromDetailModal}
              canManage={canManageReservations}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />
          </Suspense>
        )}
        
        {updateDetails && (
            <Dialog open={!!updateDetails} onOpenChange={() => setUpdateDetails(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('modals.confirm_change.title')}</DialogTitle>
                        <DialogDescription>{t('modals.confirm_change.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-semibold text-muted-foreground">{t('modals.confirm_change.original_title')}</h4>
                                <p>{t('modals.confirm_change.room')}: {updateDetails.oldReservation.rooms[0].roomName}</p>
                                <p>{t('modals.confirm_change.type')}: {updateDetails.oldReservation.rooms[0].roomTypeName}</p>
                                <p>{t('modals.confirm_change.dates')}: {format(updateDetails.oldReservation.startDate, 'PP')} to {format(updateDetails.oldReservation.endDate, 'PP')}</p>
                                <p>{t('modals.confirm_change.rate_plan')}: {updateDetails.oldReservation.rooms[0].ratePlanName || "N/A"}</p>
                                <p>{t('modals.confirm_change.price')}: {propertySettings?.currency || '$'}{(updateDetails.oldReservation.totalPrice || 0).toFixed(2)}</p>
                            </div>
                            <div className="space-y-2 border-l pl-4">
                                <h4 className="font-semibold">{t('modals.confirm_change.new_title')}</h4>
                                <p>{t('modals.confirm_change.room')}: {updateDetails.newValues.roomName}</p>
                                <p>{t('modals.confirm_change.type')}: {updateDetails.newValues.roomTypeName}</p>
                                <p>{t('modals.confirm_change.dates')}: {format(updateDetails.newValues.startDate, 'PP')} to {format(updateDetails.newValues.endDate, 'PP')}</p>
                                <p>{t('modals.confirm_change.rate_plan')}: {updateDetails.newValues.ratePlanName || "N/A"}</p>
                                <p>{t('modals.confirm_change.price')}: {propertySettings?.currency || '$'}{(updateDetails.newValues.totalPrice || 0).toFixed(2)}</p>
                            </div>
                        </div>
                        <Separator />
                        <Alert>
                            <Icons.AlertCircle className="h-4 w-4" />
                            <AlertTitle>{t('modals.confirm_change.availability_check_title')}</AlertTitle>
                            <AlertDescription>{t('modals.confirm_change.availability_check_description')}</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" onClick={() => setUpdateDetails(null)}>{t('modals.confirm_change.cancel_button')}</Button>
                        </DialogClose>
                        <Button onClick={handleConfirmUpdate} disabled={isConfirmingUpdate}>
                            {isConfirmingUpdate && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                            {t('modals.confirm_change.confirm_button')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}

      </div>
    </DndProvider>
  );
}
