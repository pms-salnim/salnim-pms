"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch, limit } from "firebase/firestore";
import type { Reservation } from "@/components/calendar/types";
import { startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, addDays, parseISO, eachDayOfInterval, addWeeks, addMonths, format, subDays, formatDistanceToNow } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import { toDate } from '@/lib/dateUtils';
import { History, UserPlus, Clock, ChevronRight } from 'lucide-react';
import type { DateRange } from "react-day-picker";
import type { FirestoreUser } from '@/types/firestoreUser';
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { RevenueAnalytics } from "@/components/dashboard/RevenueAnalytics";
import { ActivityTable } from "@/components/dashboard/ActivityTable";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import type { Room } from "@/types/room";
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import type { AvailabilitySetting } from "@/types/availabilityOverride";
import { Icons } from "@/components/icons";

const ReservationForm = dynamic(() => import('@/components/reservations/reservation-form'), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});
const ReservationDetailModal = dynamic(() => import('@/components/reservations/reservation-detail-modal'), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});

export default function DashboardPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t: tForm } = useTranslation('pages/dashboard/reservation-form');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);

  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySetting[]>([]);

  const [recentReservations, setRecentReservations] = useState<Reservation[]>([]);
  const [todaysArrivals, setTodaysArrivals] = useState<Reservation[]>([]);
  const [todaysDepartures, setTodaysDepartures] = useState<Reservation[]>([]);
  const [activityTab, setActivityTab] = useState<'checkins' | 'checkouts'>('checkins');
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const [guestCount, setGuestCount] = useState('2 Adults, 0 Children');
  const [vips, setVips] = useState<any[]>([]);
  const [guestRequests, setGuestRequests] = useState<any[]>([]);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [isReservationFormModalOpen, setIsReservationFormModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);
  const [isReservationDetailModalOpen, setIsReservationDetailModalOpen] = useState(false);
  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<Reservation | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);

  const canManageReservations = user?.permissions?.reservations;
  const { t, i18n } = useTranslation(['pages/dashboard/content', 'pages/housekeeping/daily-tasks/content']);
  const [locale, setLocale] = useState(enUS);

  // Helper to coerce Firestore Timestamps (or objects with toDate) into JS Dates
  const toDate = useCallback((val: any): Date | undefined => {
    if (!val) return undefined;
    // Firestore Timestamp has a toDate() method
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    try {
      return new Date(val);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    setLocale(i18n.language === 'fr' ? fr : enUS);
  }, [i18n.language]);

  // Check for prefilled guest data from guest list "Create Reservation"
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefilled = sessionStorage.getItem('prefilledGuestData');
      if (prefilled) {
        try {
          const guestData = JSON.parse(prefilled);
          // Create a reservation object with guest details populated
          const reservationData: Partial<Reservation> = {
            guestName: guestData.fullName || '',
            guestEmail: guestData.email || '',
            guestPhone: guestData.phone || '',
            guestCountry: guestData.country || 'Morocco',
            guestPassportOrId: guestData.passportOrId || '',
          };
          setEditingReservation(reservationData);
          setIsReservationFormModalOpen(true);
          // Note: Don't clear from sessionStorage here - let the form do it
        } catch (error) {
          console.error('Error loading prefilled guest data:', error);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    } else if (user?.id) {
      getDoc(doc(db, "staff", user.id)).then(docSnap => {
        if (docSnap.exists()) {
          setPropertyId((docSnap.data() as FirestoreUser).propertyId);
        }
      });
    }
  }, [user]);

  useEffect(() => {
     if (propertyId) {
      const unsubProp = onSnapshot(doc(db, "properties", propertyId), (docSnap) => {
        setPropertySettings(docSnap.exists() ? docSnap.data() as Property : null);
      });
      return () => unsubProp();
    }
  }, [propertyId, user?.permissions?.finance]);

  useEffect(() => {
    if (!propertyId) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);

    const parseReservation = (docSnap: any) => {
      const data = docSnap.data();
      return {
        id: docSnap.id, ...data,
        startDate: data.startDate && (data.startDate as Timestamp).toDate(),
        endDate: data.endDate && (data.endDate as Timestamp).toDate(),
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
        actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
        actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
        isCheckedOut: data.isCheckedOut || false,
      } as Reservation;
    };

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    let unsubAllRooms: (() => void) | null = null;
    let unsubAllReservations: (() => void) | null = null;
    let unsubAvailability: (() => void) | null = null;
    let unsubRecentReservations: (() => void) | null = null;
    let unsubTodaysArrivals: (() => void) | null = null;
    let unsubTodaysDepartures: (() => void) | null = null;
    let unsubGuestRequests: (() => void) | null = null;
    let unsubVips: (() => void) | null = null;

    try {
      unsubAllRooms = onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", propertyId)), (snap) => setAllRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room))), (err) => console.error('rooms snapshot error', err));
    } catch (err) {
      console.error('rooms subscription failed', err);
    }

    try {
      unsubAllReservations = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId)), (snap) => {
          setAllReservations(snap.docs.map(parseReservation));
          setIsDataLoading(false); 
      }, (err) => {
          console.error('reservations snapshot error', err);
          setIsDataLoading(false);
      });
    } catch (err) {
      console.error('reservations subscription failed', err);
      setIsDataLoading(false);
    }

    try {
      unsubAvailability = onSnapshot(query(collection(db, "availability"), where("propertyId", "==", propertyId)), (snap) => setAvailabilitySettings(snap.docs.map(d => d.data() as AvailabilitySetting)), (err) => console.error('availability snapshot error', err));
    } catch (err) {
      console.error('availability subscription failed', err);
    }

    try {
      unsubRecentReservations = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), orderBy("createdAt", "desc"), limit(10)), (snap) => setRecentReservations(snap.docs.map(parseReservation)), (err) => console.error('recentReservations snapshot error', err));
    } catch (err) {
      console.error('recentReservations subscription failed', err);
    }

    try {
      unsubTodaysArrivals = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), where("startDate", ">=", todayStart), where("startDate", "<=", todayEnd)), (snap) => setTodaysArrivals(snap.docs.map(parseReservation)), (err) => console.error('todaysArrivals snapshot error', err));
    } catch (err) {
      console.error('todaysArrivals subscription failed', err);
    }

    try {
      unsubTodaysDepartures = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), where("endDate", ">=", todayStart), where("endDate", "<=", todayEnd)), (snap) => setTodaysDepartures(snap.docs.map(parseReservation)), (err) => console.error('todaysDepartures snapshot error', err));
    } catch (err) {
      console.error('todaysDepartures subscription failed', err);
    }

    try {
      unsubGuestRequests = onSnapshot(query(collection(db, 'guestRequests'), where('propertyId', '==', propertyId), orderBy('createdAt', 'desc'), limit(10)), (snap) => setGuestRequests(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))), (err) => console.error('guestRequests snapshot error', err));
    } catch (err) {
      console.error('guestRequests subscription failed', err);
    }

    try {
      unsubVips = onSnapshot(query(collection(db, 'reservations'), where('propertyId', '==', propertyId), where('isVip', '==', true)), (snap) => setVips(snap.docs.map(parseReservation)), (err) => console.error('vips snapshot error', err));
    } catch (err) {
      console.error('vips subscription failed', err);
    }

    // Only subscribe to payments if the user has finance permission
    let unsubPayments: (() => void) | null = null;
    if (user?.permissions?.finance) {
      try {
        unsubPayments = onSnapshot(query(collection(db, `properties/${propertyId}/payments`)), (snap) => {
          setAllPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.error('payments snapshot error', err));
      } catch (err) {
        console.error('payments subscription failed', err);
      }
    }

    return () => {
      if (unsubAllRooms) unsubAllRooms();
      if (unsubAllReservations) unsubAllReservations();
      if (unsubRecentReservations) unsubRecentReservations();
      if (unsubTodaysArrivals) unsubTodaysArrivals();
      if (unsubTodaysDepartures) unsubTodaysDepartures();
      if (unsubAvailability) unsubAvailability();
      if (unsubGuestRequests) unsubGuestRequests();
      if (unsubVips) unsubVips();
      if (unsubPayments) unsubPayments();
    };
  }, [propertyId, user?.permissions?.finance]);

  const revenueTrendSeries = useMemo(() => {
    const today = startOfDay(new Date());

    const calculateRevenueForPeriod = (startDate: Date, endDate: Date) => { // endDate is inclusive
      let periodRevenue = 0;
      const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });

      allReservations.forEach(res => {
          // Include paid reservations OR checked-out reservations with settled payments
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
      // Show past 30 days (realized revenue)
      const days = Array.from({ length: numPeriods }, (_, i) => subDays(today, numPeriods - 1 - i));
      labels = days.map(d => format(d, 'MMM d'));
      revenueTrend = days.map(d => calculateRevenueForPeriod(d, d));
      
      totalRevenue = revenueTrend.reduce((sum, current) => sum + current, 0);
      
      // Compare to previous 30 days
      const prevPeriodEnd = subDays(days[0], 1);
      const prevPeriodStart = subDays(prevPeriodEnd, numPeriods - 1);
      const prevTotalRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);
      revenueChangePercentage = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    }

    if (chartPeriod === 'weekly') {
      const numPeriods = 12;
      // Show past 12 weeks (realized revenue)
      const weekStarts = Array.from({ length: numPeriods }, (_, i) => startOfWeek(addWeeks(today, -(numPeriods - 1 - i)), { weekStartsOn: 1 }));
      labels = weekStarts.map(d => format(d, 'MMM d'));
      revenueTrend = weekStarts.map(d => calculateRevenueForPeriod(d, endOfWeek(d, { weekStartsOn: 1 })));
      
      totalRevenue = revenueTrend.reduce((sum, current) => sum + current, 0);

      // Compare to previous 12 weeks
      const prevPeriodEnd = subDays(weekStarts[0], 1);
      const prevPeriodStart = subDays(prevPeriodEnd, numPeriods * 7);
      const prevTotalRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);
      revenueChangePercentage = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    }

    if (chartPeriod === 'monthly') {
      const numPeriods = 12;
      // Show past 12 months (realized revenue)
      const monthStarts = Array.from({ length: numPeriods }, (_, i) => startOfMonth(addMonths(today, -(numPeriods - 1 - i))));
      labels = monthStarts.map(d => format(d, 'MMM yyyy'));
      revenueTrend = monthStarts.map(d => calculateRevenueForPeriod(d, endOfMonth(d)));
      
      totalRevenue = revenueTrend.reduce((sum, current) => sum + current, 0);

      // Compare to previous 12 months
      const prevPeriodEnd = subDays(monthStarts[0], 1);
      const prevPeriodStart = addMonths(monthStarts[0], -numPeriods);
      const prevTotalRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);
      revenueChangePercentage = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
    }

    return { labels, revenueTrend, totalRevenue, revenueChangePercentage };
  }, [chartPeriod, allReservations, toDate]);


  
  const dashboardMetrics = useMemo(() => {
    const metrics = {
      bookings: 0,
      bookingsYesterday: 0,
      arrivals: 0,
      arrivalsCheckedIn: 0,
      departures: 0,
      departuresNotYetLeft: 0,
      inHouseGuests: 0,
      occupiedRooms: 0,
      totalRooms: 0,
      cancellations: 0,
      canceledBookings: 0,
    };

    if (!allReservations.length || !dateRange?.from) return metrics;

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    
    // Yesterday's date range
    const yesterdayStart = startOfDay(subDays(dateRange.from, 1));
    const yesterdayEnd = endOfDay(subDays(dateRange.from, 1));

    // Bookings: created in date range
    metrics.bookings = allReservations.filter(res => 
      res.createdAt && isWithinInterval(toDate(res.createdAt) as Date, { start: rangeStart, end: rangeEnd })
    ).length;
    
    // Bookings yesterday
    metrics.bookingsYesterday = allReservations.filter(res => 
      res.createdAt && isWithinInterval(toDate(res.createdAt) as Date, { start: yesterdayStart, end: yesterdayEnd })
    ).length;

    const arrivingReservations = allReservations.filter(res => 
      isWithinInterval(toDate(res.startDate) as Date, { start: rangeStart, end: rangeEnd }) && res.status !== 'Canceled' && res.status !== 'No-Show'
    );
    metrics.arrivals = arrivingReservations.length;
    
    // Arrivals already checked-in
    metrics.arrivalsCheckedIn = arrivingReservations.filter(res => res.status === 'Checked-in').length;

    const departingReservations = allReservations.filter(res => 
      isWithinInterval(toDate(res.endDate) as Date, { start: rangeStart, end: rangeEnd }) && res.status !== 'Canceled' && res.status !== 'No-Show'
    );
    metrics.departures = departingReservations.length;
    
    // Departures that haven't left yet (still Checked-in)
    metrics.departuresNotYetLeft = departingReservations.filter(res => res.status === 'Checked-in').length;
    
    const now = new Date();
    metrics.inHouseGuests = allReservations
      .filter(res => res.status === 'Checked-in')
      .reduce((sum, res) => sum + (res.rooms?.reduce((guestSum, room) => guestSum + (room.adults || 0) + (room.children || 0), 0) || 0), 0);

    metrics.cancellations = allReservations.filter(res => 
      res.status === 'Canceled' && res.updatedAt && isWithinInterval(toDate(res.updatedAt) as Date, { start: rangeStart, end: rangeEnd })
    ).length;
    
    // Canceled bookings in range
    metrics.canceledBookings = allReservations.filter(res => 
      res.status === 'Canceled' && res.createdAt && isWithinInterval(toDate(res.createdAt) as Date, { start: rangeStart, end: rangeEnd })
    ).length;
    
    const daysInRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    let totalOccupiedRoomDays = 0;
    
    daysInRange.forEach(day => {
        const occupiedOnThisDay = new Set<string>();

        // From reservations
        allReservations.forEach(res => {
            if ((res.status === 'Confirmed' || res.status === 'Checked-in')) {
              const rStart = toDate(res.startDate);
              const rEnd = toDate(res.endDate);
              if (rStart && rEnd && startOfDay(day) >= startOfDay(rStart) && startOfDay(day) < startOfDay(rEnd)) {
                if (res.rooms) {
                  res.rooms.forEach(room => occupiedOnThisDay.add(room.roomId));
                }
              }
            }
        });

        // From availability blocks
        availabilitySettings.forEach(setting => {
            if (setting.status === 'blocked' && isWithinInterval(day, { start: parseISO(setting.startDate), end: parseISO(setting.endDate)})) {
                if(setting.roomId) {
                    occupiedOnThisDay.add(setting.roomId);
                } else {
                    allRooms.forEach(room => {
                        if (room.roomTypeId === setting.roomTypeId) {
                            occupiedOnThisDay.add(room.id);
                        }
                    });
                }
            }
        });

        totalOccupiedRoomDays += occupiedOnThisDay.size;
    });

    metrics.occupiedRooms = daysInRange.length > 0 ? totalOccupiedRoomDays / daysInRange.length : 0;
    metrics.totalRooms = allRooms.length;

    return metrics;
  }, [allReservations, allRooms, dateRange, availabilitySettings]);

  const revenueMetrics = useMemo(() => {
    if (!allReservations.length || !dateRange?.from) return { adr: null, revpar: null };
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    let totalRevenue = 0;
    let roomNights = 0;

    allReservations.forEach(res => {
      const resStartDate = toDate(res.startDate);
      const resEndDate = toDate(res.endDate);
      if (!resStartDate || !resEndDate) return;
      // reservation revenue
      const revenue = res.totalPrice || 0;
      // overlap of reservation with selected range
      const resStart = startOfDay(resStartDate);
      const resEnd = startOfDay(resEndDate);
      const overlapStart = resStart > rangeStart ? resStart : rangeStart;
      const overlapEnd = resEnd < rangeEnd ? resEnd : rangeEnd;
      if (overlapStart < overlapEnd) {
        const nights = differenceInDays(overlapEnd, overlapStart);
        const roomsCount = res.rooms ? res.rooms.length : 1;
        roomNights += nights * roomsCount;
        totalRevenue += revenue;
      }
    });

    const adr = roomNights > 0 ? totalRevenue / roomNights : null;
    const occupancyRate = allRooms.length > 0 ? (Math.round(dashboardMetrics.occupiedRooms) / allRooms.length) : 0;
    const revpar = adr !== null ? adr * occupancyRate : null;
    return { adr, revpar };
  }, [allReservations, dateRange, allRooms, dashboardMetrics]);

  const occupancyDonutMetrics = useMemo(() => {
    // Calculate today's occupancy metrics
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(today);

    let bookedUnits = new Set<string>();
    let outOfServiceUnits = new Set<string>();
    let blockedDatesCount = 0;

    // Check active reservations for today
    allReservations.forEach(res => {
      const resStart = toDate(res.startDate);
      const resEnd = toDate(res.endDate);
      if (resStart && resEnd && startOfDay(resStart) <= today && startOfDay(resEnd) > today) {
        if ((res.status === 'Confirmed' || res.status === 'Checked-in') && res.rooms) {
          res.rooms.forEach(room => bookedUnits.add(room.roomId));
        }
      }
    });

    // Check availability blocks for today
    availabilitySettings.forEach(setting => {
      if (setting.status === 'blocked' && isWithinInterval(today, { start: parseISO(setting.startDate), end: parseISO(setting.endDate) })) {
        if (setting.roomId) {
          outOfServiceUnits.add(setting.roomId);
          blockedDatesCount += 1;
        } else if (setting.roomTypeId) {
          allRooms.forEach(room => {
            if (room.roomTypeId === setting.roomTypeId) {
              outOfServiceUnits.add(room.id);
            }
          });
          blockedDatesCount += 1;
        }
      }
    });

    const totalRooms = allRooms.length;
    const availableUnits = totalRooms - bookedUnits.size - outOfServiceUnits.size;
    const occupancyPercent = totalRooms > 0 ? Math.round((bookedUnits.size / totalRooms) * 100) : 0;

    return {
      occupancyPercent,
      bookedUnits: bookedUnits.size,
      availableUnits: Math.max(0, availableUnits),
      outOfService: outOfServiceUnits.size,
      blockedDates: blockedDatesCount
    };
  }, [allReservations, allRooms, availabilitySettings]);

  const channelMixMetrics = useMemo(() => {
    // Calculate channel mix from all reservations
    let direct = 0, ota = 0, walkIn = 0;

    allReservations.forEach(res => {
      if (res.source === 'Direct') direct += 1;
      else if (res.source === 'OTA') ota += 1;
      else if (res.source === 'Walk-in') walkIn += 1;
    });

    const total = direct + ota + walkIn;
    return {
      direct: total > 0 ? Number(((direct / total) * 100).toFixed(1)) : 0,
      ota: total > 0 ? Number(((ota / total) * 100).toFixed(1)) : 0,
      walkIn: total > 0 ? Number(((walkIn / total) * 100).toFixed(1)) : 0,
    };
  }, [allReservations]);

  const handleCheckIn = async (reservation: Reservation) => {
    if (!propertyId || !reservation.rooms?.[0]?.roomId || !canManageReservations) return;
    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, "reservations", reservation.id), { 
        status: 'Checked-in',
        actualCheckInTime: serverTimestamp()
      });
      
      batch.update(doc(db, "rooms", reservation.rooms[0].roomId), { status: 'Occupied' });

      await batch.commit();
      toast({title: t('toasts.check_in_success_title'), description: t('toasts.check_in_success_description', { roomName: reservation.rooms[0].roomName || '' })});
    } catch(err) {
      console.error("Error checking in:", err);
      toast({title: t('toasts.check_in_error_title'), description: t('toasts.check_in_error_description'), variant: "destructive"});
    }
  };

  const handleCheckOut = async (reservation: Reservation) => {
    if (!propertyId || !reservation.rooms?.[0]?.roomId || !canManageReservations || !user) return;
    try {
      const roomDetails = allRooms.find(r => r.id === reservation.rooms[0].roomId);

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
          title: t('pages/housekeeping/daily-tasks/content:autogenerated_task.title', { roomName: reservation.rooms[0].roomName }),
          description: t('pages/housekeeping/daily-tasks/content:autogenerated_task.description', { roomName: reservation.rooms[0].roomName, roomTypeName: reservation.rooms[0].roomTypeName, guestName: reservation.guestName }),
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
          createdByName: user.name || 'System',
          createdByUid: user.id,
      };
      batch.set(newTaskRef, taskPayload);

      await batch.commit();
      toast({title: t('toasts.check_out_success_title'), description: t('toasts.check_out_success_description', { roomName: reservation.rooms[0].roomName || '' })});
    } catch(err) {
      console.error("Error checking out:", err);
      toast({title: t('toasts.check_out_error_title'), description: t('toasts.check_out_error_description'), variant: "destructive"});
    }
  };
  


  const handleOpenReservationForm = (reservation: Partial<Reservation> | null) => {
    setEditingReservation(reservation);
    setIsReservationFormModalOpen(true);
  };

  const handleViewReservationDetails = (reservation: Reservation) => {
    setSelectedReservationForDetail(reservation);
    setIsReservationDetailModalOpen(true);
  };
  
  const handleEditFromDetailModal = (reservation: Reservation) => {
    setIsReservationDetailModalOpen(false); 
    setSelectedReservationForDetail(null);
    setEditingReservation(reservation);
    setIsReservationFormModalOpen(true);
  };

  const handleDeleteReservation = (reservationId: string) => {
     if (!propertyId || !canManageReservations) return;
    setReservationToDelete(reservationId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteReservation = async () => {
    if (!reservationToDelete || !propertyId) return;
    try {
      await deleteDoc(doc(db, "reservations", reservationToDelete));
      toast({title: t('toasts.delete_reservation_success_title'), description: t('toasts.delete_reservation_success_description')});
    } catch (error) {
      toast({title: t('toasts.delete_reservation_error_title'), description: t('toasts.delete_reservation_error_description'), variant: "destructive"});
    } finally {
        setIsDeleteDialogOpen(false);
        setReservationToDelete(null);
    }
  };


  return (
    <div className="min-h-screen bg-White text-slate-800 font-sans pb-4">
      <main className="p-2 w-full mx-auto space-y-4">
        <DashboardHeader 
          dateRange={dateRange} 
          setDateRange={setDateRange} 
          onNewReservation={() => { setIsReservationFormModalOpen(true); setEditingReservation(null); }} 
        />
        <DashboardMetrics metrics={dashboardMetrics} />
        <ActivityTable 
          todaysArrivals={todaysArrivals}
          todaysDepartures={todaysDepartures}
          activityTab={activityTab}
          setActivityTab={setActivityTab}
          onViewDetails={handleViewReservationDetails}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onCancel={handleViewReservationDetails}
          propertySettings={propertySettings}
          occupancyPercent={occupancyDonutMetrics.occupancyPercent}
          bookedUnits={occupancyDonutMetrics.bookedUnits}
          availableUnits={occupancyDonutMetrics.availableUnits}
          outOfService={occupancyDonutMetrics.outOfService}
          blockedDates={occupancyDonutMetrics.blockedDates}
          channelDirect={channelMixMetrics.direct}
          channelOta={channelMixMetrics.ota}
          channelWalkIn={channelMixMetrics.walkIn}
        />
        <RevenueAnalytics 
          chartPeriod={chartPeriod} 
          setChartPeriod={setChartPeriod} 
          propertySettings={propertySettings}
          propertyId={propertyId}
          dateRange={dateRange}
          housekeepingWidget={
            <DashboardSidebar 
              propertyId={propertyId}
              propertySettings={propertySettings}
              vips={vips}
              guestRequests={guestRequests}
              recentReservations={recentReservations}
            />
          }
        />
        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <History size={18} style={{ color: '#003166' }} />
            <h2 className="text-sm font-bold text-slate-800">{t('recent_reservations.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentReservations.slice(0, 6).map((res, i) => (
              <div key={res.id || i} className="flex justify-between items-center pb-3 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#003166]"><UserPlus size={14} /></div>
                  <div>
                    <p className="text-xs font-bold">{res.guestName}</p>
                    <p className="text-[10px] text-slate-400">{Array.isArray(res.rooms) ? `${(toDate(res.endDate) && toDate(res.startDate)) ? differenceInDays(toDate(res.endDate) as Date, toDate(res.startDate) as Date) : 0} nights • ${res.rooms.map(r => r.roomTypeName).join(', ')}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600">{propertySettings?.currency || '$'}{Number(res.totalPrice || 0).toFixed(2)}</p>
                  <div className="flex items-center justify-end text-[9px] text-slate-400"><Clock size={8} className="mr-0.5" /> {formatDistanceToNow(toDate(res.createdAt) || new Date(), { addSuffix: true })}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 py-2.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter">{t('recent_reservations.view_all_button')} <ChevronRight size={12} /></button>
        </section>
      </main>
      {/* Modals and dialogs preserved */}
      <Dialog open={isReservationFormModalOpen} onOpenChange={(isOpen) => { setIsReservationFormModalOpen(isOpen); if(!isOpen) setEditingReservation(null); }}>
        <DialogContent className="sm:max-w-5xl p-0 h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6">
              <DialogTitle>{editingReservation?.id ? tForm('edit_title') : tForm('create_title')}</DialogTitle>
              <DialogDescription>{editingReservation?.id ? tForm('edit_description') : tForm('create_description')}</DialogDescription>
          </DialogHeader>
          <ReservationForm
            onClose={() => { setIsReservationFormModalOpen(false); setEditingReservation(null); }}
            initialData={editingReservation as Reservation | null}
          />
        </DialogContent>
      </Dialog>

      {selectedReservationForDetail && (
        <ReservationDetailModal
          isOpen={isReservationDetailModalOpen}
          onClose={() => {
            setIsReservationDetailModalOpen(false);
            setSelectedReservationForDetail(null);
          }}
          initialData={selectedReservationForDetail}
          propertySettings={propertySettings}
          onEdit={handleEditFromDetailModal}
          canManage={canManageReservations}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modals.delete_confirmation.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modals.delete_confirmation.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('modals.delete_confirmation.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteReservation}>{t('modals.delete_confirmation.continue_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
