"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { DollarSign, Filter, ArrowUpRight, TrendingUp as LucideTrendingUp, ChevronRight as LucideChevronRight, PieChart as LucidePieChart, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import type { Property } from '@/types/property';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, addWeeks, addMonths, format, subDays, eachDayOfInterval } from "date-fns";

interface RevenueAnalyticsProps {
  chartPeriod: 'daily' | 'weekly' | 'monthly';
  setChartPeriod: (period: 'daily' | 'weekly' | 'monthly') => void;
  propertySettings: Property | null;
  propertyId: string | null;
  dateRange: { from: Date; to: Date } | undefined;
  checkAvailabilityWidget?: React.ReactNode;
  housekeepingWidget?: React.ReactNode;
}

export function RevenueAnalytics({ chartPeriod, setChartPeriod, propertySettings, propertyId, dateRange, checkAvailabilityWidget, housekeepingWidget }: RevenueAnalyticsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Helper to coerce Firestore Timestamps into JS Dates
  const toDate = useCallback((val: any): Date | undefined => {
    if (!val) return undefined;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    try {
      return new Date(val);
    } catch {
      return undefined;
    }
  }, []);

  const generateSmoothPath = (data: { val: number }[]) => {
    if (data.length === 0) return "";
    const maxRev = Math.max(...data.map(d => d.val), 1);
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 1000;
      const y = 200 - (d.val / (maxRev * 1.2)) * 200;
      return { x, y };
    });

    if (points.length < 2) return `M ${points[0]?.x || 0} ${points[0]?.y || 200}`;
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  };

  const [channelData, setChannelData] = useState({
    direct: 0,
    ota: 0,
    walkIn: 0,
  });

  const [yieldData, setYieldData] = useState({
    adr: 0,
    adrChange: 0,
    revpar: 0,
    revparChange: 0,
  });

  const [pendingPayments, setPendingPayments] = useState({
    totalDue: 0,
    count: 0,
  });

  const [allReservations, setAllReservations] = useState<any[]>([]);

  // Fetch reservations for revenue trend calculation
  useEffect(() => {
    if (!propertyId) return;

    const fetchReservations = async () => {
      const snapshot = await getDocs(query(collection(db, 'reservations'), where('propertyId', '==', propertyId)));
      setAllReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchReservations();
  }, [propertyId]);

  // Calculate revenue trend series with proper filtering
  const revenueTrendSeries = useMemo(() => {
    const today = startOfDay(new Date());

    const calculateRevenueForPeriod = (periodStart: Date, periodEnd: Date) => {
      let periodRevenue = 0;
      const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });

      allReservations.forEach(res => {
        // Include only paid reservations
        if (res.paymentStatus && String(res.paymentStatus).toLowerCase() === 'paid') {
          const resStartDate = toDate(res.startDate);
          const resEndDate = toDate(res.endDate);
          if (!resStartDate || !resEndDate) return;
          const resStart = startOfDay(resStartDate);
          const resEnd = startOfDay(resEndDate);

          if (resStart >= resEnd) return; // Invalid reservation dates

          const totalResDays = differenceInDays(resEnd, resStart) || 1;
          const dailyRevenue = (res.totalPrice || 0) / totalResDays;

          daysInPeriod.forEach(day => {
            const d = startOfDay(day);
            if (d >= resStart && d < resEnd) {
              periodRevenue += dailyRevenue;
            }
          });
        }
      });
      return periodRevenue;
    };

    let labels: string[] = [];
    let revenueTrend: number[] = [];
    let totalRevenue = 0;
    let revenueChangePercentage = 0;

    if (chartPeriod === 'daily') {
      const numPeriods = 30;
      const pastDays = 15;
      const futureDays = 14;
      // Show 15 days in past and 14 days in future, with today in the middle
      const days = Array.from({ length: numPeriods }, (_, i) => subDays(today, pastDays - i));
      labels = days.map(d => format(d, 'MMM d'));
      revenueTrend = days.map(d => calculateRevenueForPeriod(d, d));
      
      totalRevenue = revenueTrend.slice(0, pastDays + 1).reduce((sum, current) => sum + current, 0);
      
      // Compare to previous period
      const prevPeriodEnd = subDays(days[0], 1);
      const prevPeriodStart = subDays(prevPeriodEnd, numPeriods - 1);
      const prevTotalRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);
      revenueChangePercentage = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    }

    if (chartPeriod === 'weekly') {
      const numPeriods = 12;
      const pastWeeks = 6;
      const futureWeeks = 5;
      // Show 6 weeks in past and 5 weeks in future, with this week in the middle
      const weekStarts = Array.from({ length: numPeriods }, (_, i) => startOfWeek(addWeeks(today, -(pastWeeks - i)), { weekStartsOn: 1 }));
      labels = weekStarts.map(d => format(d, 'MMM d'));
      revenueTrend = weekStarts.map(d => calculateRevenueForPeriod(d, endOfWeek(d, { weekStartsOn: 1 })));
      
      totalRevenue = revenueTrend.slice(0, pastWeeks + 1).reduce((sum, current) => sum + current, 0);

      // Compare to previous period
      const prevPeriodEnd = subDays(weekStarts[0], 1);
      const prevPeriodStart = subDays(prevPeriodEnd, numPeriods * 7);
      const prevTotalRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);
      revenueChangePercentage = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    }

    if (chartPeriod === 'monthly') {
      const numPeriods = 12;
      const pastMonths = 6;
      const futureMonths = 5;
      // Show 6 months in past and 5 months in future, with this month in the middle
      const monthStarts = Array.from({ length: numPeriods }, (_, i) => startOfMonth(addMonths(today, -(pastMonths - i))));
      labels = monthStarts.map(d => format(d, 'MMM yyyy'));
      revenueTrend = monthStarts.map(d => calculateRevenueForPeriod(d, endOfMonth(d)));
      
      totalRevenue = revenueTrend.slice(0, pastMonths + 1).reduce((sum, current) => sum + current, 0);

      // Compare to previous period
      const prevPeriodEnd = subDays(monthStarts[0], 1);
      const prevPeriodStart = addMonths(monthStarts[0], -numPeriods);
      const prevTotalRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);
      revenueChangePercentage = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    }

    return { labels, revenueTrend, totalRevenue, revenueChangePercentage };
  }, [chartPeriod, allReservations, toDate]);

  useEffect(() => {
    if (!propertyId) return;

    const fetchChannelData = async () => {
      const snapshot = await getDocs(query(collection(db, 'reservations'), where('propertyId', '==', propertyId)));
      const data = snapshot.docs.reduce(
        (acc, doc) => {
          const { source } = doc.data();
          if (source === 'Direct') acc.direct += 1;
          else if (source === 'OTA') acc.ota += 1;
          else if (source === 'Walk-in') acc.walkIn += 1;
          return acc;
        },
        { direct: 0, ota: 0, walkIn: 0 }
      );

      const total = data.direct + data.ota + data.walkIn;
      setChannelData({
        direct: total > 0 ? Number(((data.direct / total) * 100).toFixed(1)) : 0,
        ota: total > 0 ? Number(((data.ota / total) * 100).toFixed(1)) : 0,
        walkIn: total > 0 ? Number(((data.walkIn / total) * 100).toFixed(1)) : 0,
      });
    };

    fetchChannelData();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    const fetchYieldData = async () => {
      // Get today and yesterday date ranges
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date(yesterday);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);

      // Fetch reservations with propertyId filter
      const reservationsSnapshot = await getDocs(query(collection(db, 'reservations'), where('propertyId', '==', propertyId)));
      
      // Calculate for today
      const calculateMetrics = (startDate: Date, endDate: Date) => {
        let totalRoomRevenue = 0;
        let totalRoomNights = 0;

        reservationsSnapshot.docs.forEach(doc => {
          const reservation = doc.data();
          const status = reservation.status;
          
          // Exclude cancellations and no-shows
          if (status === 'Canceled' || status === 'No-Show') return;

          const resStartDate = reservation.startDate?.toDate ? reservation.startDate.toDate() : new Date(reservation.startDate);
          const resEndDate = reservation.endDate?.toDate ? reservation.endDate.toDate() : new Date(reservation.endDate);

          // Check if reservation overlaps with our date range
          if (resStartDate < endDate && resEndDate > startDate) {
            // Calculate overlapping nights
            const overlapStart = resStartDate > startDate ? resStartDate : startDate;
            const overlapEnd = resEndDate < endDate ? resEndDate : endDate;
            const nightsInRange = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));

            if (nightsInRange > 0) {
              // Calculate room revenue (excluding taxes, fees, and extras)
              const roomsTotal = reservation.roomsTotal || 0;
              const extrasTotal = reservation.extrasTotal || 0;
              const taxAmount = reservation.taxAmount || 0;
              
              // Room revenue = total price - extras - taxes
              const totalRevenue = reservation.totalPrice || roomsTotal + extrasTotal + taxAmount;
              const roomRevenue = totalRevenue - extrasTotal - taxAmount;
              
              // Calculate total nights for the reservation
              const totalNights = Math.max(1, Math.ceil((resEndDate.getTime() - resStartDate.getTime()) / (1000 * 60 * 60 * 24)));
              
              // Prorate revenue for the overlapping nights
              const proratedRevenue = (roomRevenue / totalNights) * nightsInRange;
              
              totalRoomRevenue += proratedRevenue;
              totalRoomNights += nightsInRange * (reservation.rooms?.length || 1);
            }
          }
        });

        return { totalRoomRevenue, totalRoomNights };
      };

      // Calculate today's metrics
      const todayMetrics = calculateMetrics(today, new Date(today.getTime() + 24 * 60 * 60 * 1000));
      const yesterdayMetrics = calculateMetrics(yesterday, today);

      // Fetch total available rooms (excluding out-of-order rooms)
      const roomsSnapshot = await getDocs(query(collection(db, 'rooms'), where('propertyId', '==', propertyId)));
      const availableRooms = roomsSnapshot.docs.filter(doc => {
        const room = doc.data();
        return room.status !== 'Out of Order';
      }).length;

      // Calculate ADR (Average Daily Rate) = Room Revenue / Room Nights Sold
      const todayAdr = todayMetrics.totalRoomNights > 0 
        ? todayMetrics.totalRoomRevenue / todayMetrics.totalRoomNights 
        : 0;
      const yesterdayAdr = yesterdayMetrics.totalRoomNights > 0 
        ? yesterdayMetrics.totalRoomRevenue / yesterdayMetrics.totalRoomNights 
        : 0;

      // Calculate RevPAR = Room Revenue / Available Rooms
      const todayRevpar = availableRooms > 0 
        ? todayMetrics.totalRoomRevenue / availableRooms 
        : 0;
      const yesterdayRevpar = availableRooms > 0 
        ? yesterdayMetrics.totalRoomRevenue / availableRooms 
        : 0;

      // Calculate changes
      const adrChange = yesterdayAdr > 0 ? todayAdr - yesterdayAdr : 0;
      const revparChange = yesterdayRevpar > 0 
        ? ((todayRevpar - yesterdayRevpar) / yesterdayRevpar) * 100 
        : 0;

      setYieldData({
        adr: todayAdr,
        adrChange,
        revpar: todayRevpar,
        revparChange,
      });
    };

    fetchYieldData();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    const fetchPendingPayments = async () => {
      const snapshot = await getDocs(query(collection(db, 'reservations'), where('propertyId', '==', propertyId)));
      
      let totalDue = 0;
      let count = 0;

      snapshot.docs.forEach(doc => {
        const reservation = doc.data();
        const paymentStatus = reservation.paymentStatus;
        
        // Only include unpaid or partially paid reservations
        if (paymentStatus === 'Pending' || paymentStatus === 'Partial') {
          const totalPrice = reservation.totalPrice || 0;
          const partialPayment = reservation.partialPaymentAmount || 0;
          
          // Calculate amount due
          const amountDue = totalPrice - partialPayment;
          
          if (amountDue > 0) {
            totalDue += amountDue;
            count += 1;
          }
        }
      });

      setPendingPayments({
        totalDue,
        count,
      });
    };

    fetchPendingPayments();
  }, [propertyId]);

  return (
    <>
      <div className="space-y-6">
        {/* Check Availability Widget - Full Width */}
        {checkAvailabilityWidget && (
          <div>
            {checkAvailabilityWidget}
          </div>
        )}

        {/* Sidebar: Housekeeping, Pending Payments, Performance, Channel Mix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Housekeeping Widget */}
        {housekeepingWidget && housekeepingWidget}

        <div className="bg-white rounded-xl p-5 shadow-sm border border-amber-200 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} style={{ color: '#f59e0b' }} />
            <h2 className="text-sm font-bold text-slate-800">Pending Payments</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tighter text-amber-600">
                {propertySettings?.currency || '$'}{pendingPayments.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {pendingPayments.count} {pendingPayments.count === 1 ? 'reservation' : 'reservations'} with outstanding balance
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-2">
              <LucideTrendingUp size={18} style={{ color: '#003166' }} />
              <h2 className="text-sm font-bold text-slate-800">Performance</h2>
            </div>
            <p className="text-[9px] text-slate-400 font-medium">Based on stayed nights</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[10px] font-bold text-slate-400 uppercase">ADR</p>
              <div className="flex items-center justify-between">
                <span className="text-l font-bold">{propertySettings?.currency || '$'}{yieldData.adr.toFixed(2)}</span>
              </div>
              <p className={`text-[9px] font-bold ${yieldData.adrChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {yieldData.adrChange >= 0 ? '+' : ''}{propertySettings?.currency || '$'}{Math.abs(yieldData.adrChange).toFixed(2)} vs yesterday
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[10px] font-bold text-slate-400 uppercase">RevPAR</p>
              <div className="flex items-center justify-between">
                <span className="text-l font-bold">{propertySettings?.currency || '$'}{yieldData.revpar.toFixed(2)}</span>
              </div>
              <p className={`text-[9px] font-bold ${yieldData.revparChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {yieldData.revparChange >= 0 ? '+' : ''}{Math.abs(yieldData.revparChange).toFixed(1)}% vs yesterday
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4"><LucidePieChart size={18} style={{ color: '#003166' }} /><h2 className="text-sm font-bold text-slate-800">Channel Mix</h2></div>
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#eee" strokeWidth="4"></circle>
                <circle cx="18" cy="18" r="16" fill="none" stroke="#003166" strokeWidth="4" strokeDasharray={`${channelData.direct} 100`}></circle>
                <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${channelData.ota} 100`} strokeDashoffset={`-${channelData.direct}`}></circle>
                <circle cx="18" cy="18" r="16" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${channelData.walkIn} 100`} strokeDashoffset={`-${channelData.direct + channelData.ota}`}></circle>
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#003166]"></div>
                <span className="text-[10px] font-bold">Direct ({channelData.direct}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                <span className="text-[10px] font-bold">OTA ({channelData.ota}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                <span className="text-[10px] font-bold">Walk-in ({channelData.walkIn}%)</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
