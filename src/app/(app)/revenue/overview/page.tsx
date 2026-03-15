

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RevenueFilters from '@/components/revenue/revenue-filters';
import RevenueCards from '@/components/revenue/revenue-cards';
import RevenueChart from '@/components/revenue/revenue-chart';
import RevenueBreakdown from '@/components/revenue/revenue-breakdown';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc } from 'firebase/firestore';
import type { Reservation } from '@/components/calendar/types';
import type { Property } from '@/types/property';
import type { Room } from '@/types/room';
import type { RoomType } from '@/types/roomType';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import {
  differenceInDays,
  startOfDay,
  endOfDay,
  format,
  eachDayOfInterval,
  isWithinInterval,
  addDays,
  eachWeekOfInterval,
  getISOWeek,
  startOfWeek,
  parseISO,
  eachMonthOfInterval,
  isEqual,
  startOfMonth,
  subDays,
} from 'date-fns';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import type { Payment } from '@/app/(app)/payments/page';

export default function RevenueOverviewPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/revenue/overview/content');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySetting[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<any>({
    dateRange: { from: subDays(new Date(), 29), to: new Date() },
    bookingSource: 'all',
    roomType: 'all',
  });

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const dataSources = [
      { col: "properties", id: propertyId, setter: setPropertySettings, isDoc: true },
      { col: "reservations", setter: setReservations, process: (d: any) => ({ ...d, startDate: d.startDate.toDate(), endDate: d.endDate.toDate(), createdAt: d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate() : new Date() }) },
      { col: "rooms", setter: setAllRooms },
      { col: "roomTypes", setter: setRoomTypes },
      { col: "availability", setter: setAvailabilitySettings },
      { col: "payments", setter: setPayments }
    ];

    let listenersCount = dataSources.length;
    const doneLoading = () => {
        listenersCount--;
        if (listenersCount <= 0) setIsLoading(false);
    }

    const unsubscribers = dataSources.map(source => {
      const q = source.isDoc 
        ? doc(db, source.col, source.id!)
        : query(collection(db, source.col), where("propertyId", "==", propertyId));
      
      return onSnapshot(q as any, (snapshot: any) => {
        if (source.isDoc) {
          source.setter(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as any : null);
        } else {
          source.setter(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data(), ...(source.process ? source.process(d.data()) : {}) } as any)));
        }
        if(listenersCount > 0) doneLoading();
      }, (err) => {
          console.error(`Error fetching ${source.col}:`, err);
          if(listenersCount > 0) doneLoading();
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [propertyId]);

  const uniqueRoomTypes = useMemo(() => {
    if (!roomTypes) return [];
    return roomTypes.map(rt => rt.name).sort();
  }, [roomTypes]);

  const uniqueBookingSources = useMemo(() => {
    if (!reservations) return [];
    const sources = reservations.map(res => res.source).filter((s): s is 'Direct' | 'Walk-in' | 'OTA' => !!s);
    return [...new Set(sources)].sort();
  }, [reservations]);
  
  const calculateExtrasTotal = useCallback((reservation: Reservation): number => {
    if (!reservation.selectedExtras || reservation.selectedExtras.length === 0) return 0;
    
    const nights = differenceInDays(reservation.endDate, reservation.startDate);
    if (nights <= 0) return 0;

    const totalGuests = (reservation.adults || 0) + (reservation.children || 0);

    return reservation.selectedExtras.reduce((total, extra) => {
        let itemTotal = 0;
        const { price: unitPrice, quantity, unit } = extra;
        
        switch(unit) {
            case 'one_time':
            case 'per_booking':
            case 'one_time_per_room':
                itemTotal = unitPrice * quantity;
                break;
            case 'per_night':
            case 'per_night_per_room':
                itemTotal = unitPrice * nights * quantity;
                break;
            case 'per_guest':
            case 'one_time_per_guest':
                itemTotal = unitPrice * totalGuests * quantity;
                break;
            case 'per_night_per_guest':
                itemTotal = unitPrice * nights * totalGuests * quantity;
                break;
            default:
                itemTotal = unitPrice * quantity;
        }
        return total + itemTotal;
    }, 0);
  }, []);

  const calculatedMetrics = useMemo(() => {
    if (!activeFilters.dateRange?.from || !activeFilters.dateRange?.to) {
      return { totalRevenue: 0, totalBookings: 0, averageDailyRate: 0, occupancyRate: 0, revPAR: 0, canceledBookingsValue: 0, stayRevenue: 0, pendingRevenue: 0 };
    }

    const filterStart = startOfDay(activeFilters.dateRange.from);
    const filterEnd = endOfDay(activeFilters.dateRange.to);

    const filteredReservations = reservations.filter(res => {
        if (!res.createdAt || !isWithinInterval(res.createdAt, { start: filterStart, end: filterEnd })) {
            return false;
        }
        // Apply other filters
        const roomTypeNameForRes = roomTypes.find(rt => rt.id === res.roomTypeId)?.name;
        if (activeFilters.roomType !== 'all' && roomTypeNameForRes !== activeFilters.roomType) return false;
        if (activeFilters.bookingSource !== 'all' && res.source?.toLowerCase().replace(" ", "-") !== activeFilters.bookingSource) return false;
        
        return true;
    });

    const revenueReservations = filteredReservations.filter(res => 
        res.paymentStatus === 'Paid' && !res.paidWithPoints
    );
    
    const canceledReservations = filteredReservations.filter(res => res.status === 'Canceled');

    const totalRevenue = revenueReservations.reduce((sum, res) => sum + (res.totalPrice || 0), 0);
    const totalBookings = revenueReservations.length;
    const canceledBookingsValue = canceledReservations.reduce((sum, res) => sum + (res.totalPrice || 0), 0);
    
    // --- Occupancy and Stay-based metrics ---
    let totalRoomRevenueForStays = 0;
    let totalNightsBookedInPeriod = 0;
    let stayRevenue = 0;
    
    const revenueGeneratingStays = reservations.filter(res => 
      res.paymentStatus === 'Paid' && !res.paidWithPoints
    );
    
    revenueGeneratingStays.forEach(res => {
        const resStart = startOfDay(res.startDate);
        const resEnd = startOfDay(res.endDate);
        if (resStart >= filterEnd || resEnd <= filterStart) return;

        const totalNightsForRes = differenceInDays(resEnd, resStart);
        if (totalNightsForRes <= 0) return;
        
        const netAmount = res.netAmount ?? ((res.totalPrice || 0) - (res.taxAmount || 0));
        const revenuePerNight = netAmount / totalNightsForRes;
        
        const roomRevenueForRes = (res.roomsTotal || netAmount - (res.extrasTotal || 0)); // Fallback if roomsTotal missing
        const roomRevenuePerNight = roomRevenueForRes / totalNightsForRes;
        
        const daysInStay = eachDayOfInterval({ start: resStart, end: addDays(resEnd, -1) });
        
        daysInStay.forEach(dayOfStay => {
            if (isWithinInterval(dayOfStay, { start: filterStart, end: filterEnd })) {
                totalRoomRevenueForStays += roomRevenuePerNight;
                stayRevenue += revenuePerNight;
                totalNightsBookedInPeriod += 1;
            }
        });
    });

    const totalPhysicalRooms = allRooms.length;
    let occupancyRate = 0;
    let revPAR = 0;
    
    if (totalPhysicalRooms > 0) {
      const daysInFilterInterval = differenceInDays(filterEnd, filterStart) + 1;
      const totalAvailableRoomNights = totalPhysicalRooms * daysInFilterInterval;

      if (totalAvailableRoomNights > 0) {
          occupancyRate = (totalNightsBookedInPeriod / totalAvailableRoomNights) * 100;
          revPAR = totalRoomRevenueForStays / totalAvailableRoomNights;
      }
    }
    
    const averageDailyRate = totalNightsBookedInPeriod > 0 ? totalRoomRevenueForStays / totalNightsBookedInPeriod : 0;
    
    const pendingReservations = reservations.filter(
        res => (res.paymentStatus === 'Pending' || res.paymentStatus === 'Partial') && !res.paidWithPoints
    );
    
    const pendingRevenue = pendingReservations.reduce((totalDue, res) => {
        const totalPaid = payments
            .filter(p => p.reservationId === res.id && p.status === 'Paid')
            .reduce((sum, p) => sum + p.amountPaid, 0);
        const due = (res.totalPrice || 0) - totalPaid;
        return totalDue + (due > 0 ? due : 0);
    }, 0);


    return {
      totalRevenue,
      totalBookings,
      averageDailyRate,
      occupancyRate,
      revPAR,
      canceledBookingsValue,
      stayRevenue,
      pendingRevenue,
    };
  }, [reservations, roomTypes, allRooms, activeFilters, calculateExtrasTotal, payments]);

  const chartData = useMemo(() => {
    if (!activeFilters.dateRange?.from || !activeFilters.dateRange.to) {
      return [];
    }
    const filterStart = startOfDay(activeFilters.dateRange.from);
    const filterEnd = endOfDay(activeFilters.dateRange.to);
    
    const isSingleDay = isEqual(startOfDay(activeFilters.dateRange.from), startOfDay(activeFilters.dateRange.to));

    let groupBy: 'hour' | 'day' | 'week' | 'month';
    if (isSingleDay) {
      groupBy = 'hour';
    } else {
      const dayDifference = differenceInDays(filterEnd, filterStart);
      if (dayDifference <= 60) groupBy = 'day';
      else if (dayDifference <= 730) groupBy = 'week';
      else groupBy = 'month';
    }

    const revenueMap = new Map<string, number>();
    const dateLabelMap = new Map<string, string>();

    const commonFilterFunction = (res: Reservation) => {
        const isRevenueGenerating = res.paymentStatus === 'Paid' && !res.paidWithPoints;
        if (!isRevenueGenerating) return false;
        const roomTypeNameForRes = roomTypes.find(rt => rt.id === res.roomTypeId)?.name;
        if (activeFilters.roomType !== 'all' && roomTypeNameForRes !== activeFilters.roomType) return false;
        const sourceMatch = activeFilters.bookingSource === 'all' || res.source?.toLowerCase().replace(" ", "-") === activeFilters.bookingSource;
        if (!sourceMatch) return false;
        return true;
    };
    
    // Initialize map keys based on group by
    if (groupBy === 'hour') {
      for (let i = 0; i < 24; i++) {
        const hourString = i.toString().padStart(2, '0');
        revenueMap.set(hourString, 0);
        dateLabelMap.set(hourString, `${hourString}:00`);
      }
    } else if (groupBy === 'day') {
      eachDayOfInterval({ start: filterStart, end: filterEnd }).forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        revenueMap.set(key, 0);
        dateLabelMap.set(key, format(day, 'MMM d'));
      });
    } else if (groupBy === 'week') {
      eachWeekOfInterval({ start: filterStart, end: filterEnd }, { weekStartsOn: 1 }).forEach(weekStart => {
        const key = format(weekStart, 'yyyy-ww');
        revenueMap.set(key, 0);
        dateLabelMap.set(key, `W${getISOWeek(weekStart)}`);
      });
    } else { // month
      eachMonthOfInterval({ start: filterStart, end: filterEnd }).forEach(monthStart => {
        const key = format(monthStart, 'yyyy-MM');
        revenueMap.set(key, 0);
        dateLabelMap.set(key, format(monthStart, 'MMM yyyy'));
      });
    }

    const relevantReservations = reservations.filter(res => 
        res.createdAt && isWithinInterval(res.createdAt, { start: filterStart, end: filterEnd }) && commonFilterFunction(res)
    );
      
    relevantReservations.forEach(res => {
      if (!res.createdAt || !res.totalPrice) return;
      let key = '';
      if (groupBy === 'hour') key = format(res.createdAt, 'HH');
      else if (groupBy === 'day') key = format(res.createdAt, 'yyyy-MM-dd');
      else if (groupBy === 'week') key = format(startOfWeek(res.createdAt, { weekStartsOn: 1 }), 'yyyy-ww');
      else key = format(startOfMonth(res.createdAt), 'yyyy-MM');
      
      if (revenueMap.has(key)) {
          revenueMap.set(key, (revenueMap.get(key) || 0) + res.totalPrice);
      }
    });

    const sortedKeys = Array.from(revenueMap.keys()).sort();
    return sortedKeys.map(key => ({
        date: dateLabelMap.get(key) || '',
        revenue: parseFloat((revenueMap.get(key) || 0).toFixed(2)),
    }));
  }, [reservations, roomTypes, allRooms, activeFilters]);

  const breakdownData = useMemo(() => {
    if (!activeFilters.dateRange?.from || !activeFilters.dateRange?.to) {
      return { breakdownByRoomType: [], breakdownBySource: [] };
    }
    const filterStart = startOfDay(activeFilters.dateRange.from);
    const filterEnd = endOfDay(activeFilters.dateRange.to);

    const relevantReservations = reservations.filter(res => {
        if (!res.createdAt || !isWithinInterval(res.createdAt, { start: filterStart, end: filterEnd })) return false;
        
        const isRevenueGenerating = res.paymentStatus === 'Paid' && !res.paidWithPoints;
        if (!isRevenueGenerating) return false;

        const roomTypeNameForRes = roomTypes.find(rt => rt.id === res.roomTypeId)?.name;
        if (activeFilters.roomType !== 'all' && roomTypeNameForRes !== activeFilters.roomType) return false;
        
        if (activeFilters.bookingSource !== 'all' && res.source?.toLowerCase().replace(" ", "-") !== activeFilters.bookingSource) return false;

        return true;
    });

    const totalRevenue = relevantReservations.reduce((sum, res) => sum + (res.totalPrice || 0), 0);
    if (totalRevenue === 0 || !relevantReservations) {
      return { breakdownByRoomType: [], breakdownBySource: [] };
    }
    
    const byRoomType: { [key: string]: number } = {};
    const bySource: { [key: string]: number } = {};

    relevantReservations.forEach(res => {
        if (!res.totalPrice) return;
        const roomTypeName = roomTypes.find(rt => rt.id === res.roomTypeId)?.name || 'Unknown';
        const sourceName = res.source || 'Unknown';

        if (!byRoomType[roomTypeName]) byRoomType[roomTypeName] = 0;
        byRoomType[roomTypeName] += res.totalPrice;
        
        if (!bySource[sourceName]) bySource[sourceName] = 0;
        bySource[sourceName] += res.totalPrice;
    });

    const roomTypeColors = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
    const breakdownByRoomType = Object.entries(byRoomType)
        .sort(([, a], [, b]) => b - a)
        .map(([label, revenue], index) => ({
            label,
            revenue,
            percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
            colorClass: roomTypeColors[index % roomTypeColors.length],
        }));

    const sourceColors = ['bg-chart-5', 'bg-chart-4', 'bg-chart-2', 'bg-chart-1'];
    const breakdownBySource = Object.entries(bySource)
        .sort(([,a], [,b]) => b-a)
        .map(([label, revenue], index) => ({
            label,
            revenue,
            percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
            colorClass: sourceColors[index % sourceColors.length],
        }));

    return { breakdownByRoomType, breakdownBySource };
  }, [reservations, roomTypes, allRooms, activeFilters]);

  const handleFilterChange = useCallback((newFilters: any) => {
    setActiveFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  if (isLoadingAuth || (isLoading && !propertyId)) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">{t('loading')}</p></div>;
  }
  
  if (!user?.permissions?.reports) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          {/* Title and description are now in the layout */}
        </div>
      </div>

      <RevenueFilters 
        onApplyFilters={handleFilterChange} 
        roomTypes={uniqueRoomTypes}
        bookingSources={uniqueBookingSources}
      />
      <RevenueCards
        totalRevenue={calculatedMetrics.totalRevenue}
        stayRevenue={calculatedMetrics.stayRevenue}
        pendingRevenue={calculatedMetrics.pendingRevenue}
        totalBookings={calculatedMetrics.totalBookings}
        averageDailyRate={calculatedMetrics.averageDailyRate}
        occupancyRate={calculatedMetrics.occupancyRate}
        revPAR={calculatedMetrics.revPAR}
        canceledBookingsValue={calculatedMetrics.canceledBookingsValue}
        currency={propertySettings?.currency || "$"}
        isLoading={isLoading}
      />
      <RevenueChart
        chartData={chartData}
        currency={propertySettings?.currency || "$"}
      />
      <RevenueBreakdown 
        breakdownDataByRoomType={breakdownData.breakdownByRoomType || []} 
        breakdownDataBySource={breakdownData.breakdownBySource || []}
        currency={propertySettings?.currency || "$"} />
    </div>
  );
}

    
    