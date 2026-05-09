"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { createClient } from "@/utils/supabase/client";
import type { Reservation } from "@/components/calendar/types";
import { startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, addDays, parseISO, eachDayOfInterval, addWeeks, addMonths, format, subDays, formatDistanceToNow } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import { History, ChevronRight } from 'lucide-react';
import type { DateRange } from "react-day-picker";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { ActivityTable } from "@/components/dashboard/ActivityTable";
import ReservationList from "@/components/reservations/reservation-list";
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

const MAX_RECENT_RESERVATIONS = 10;

export default function DashboardPage() {
  const router = useRouter();
  const { user, property } = useAuth();
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

  const [isDataLoading, setIsDataLoading] = useState(true);

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
          const reservationData: Partial<Reservation> = {
            guestName: guestData.fullName || '',
            guestEmail: guestData.email || '',
            guestPhone: guestData.phone || '',
            guestCountry: guestData.country || 'Morocco',
            guestPassportOrId: guestData.passportOrId || '',
          };
          setEditingReservation(reservationData);
          setIsReservationFormModalOpen(true);
        } catch (error) {
          console.error('Error loading prefilled guest data:', error);
        }
      }
    }
  }, []);

  useEffect(() => {
    setPropertyId((property as any)?.id ?? user?.propertyId ?? null);
    setPropertySettings(property || null);
  }, [property, user?.propertyId]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const supabase = createClient();
    let sessionData = null;

    for (let attempts = 0; attempts < 3; attempts++) {
      const result = await supabase.auth.getSession();
      if (result.data?.session) {
        sessionData = result.data;
        break;
      }
      if (attempts < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (!sessionData?.session) return null;
    return { Authorization: `Bearer ${sessionData.session.access_token}` };
  }, []);

  const mapReservation = useCallback((reservation: any) => ({
      ...reservation,
      startDate: reservation.startDate ? new Date(reservation.startDate) : undefined,
      endDate: reservation.endDate ? new Date(reservation.endDate) : undefined,
      createdAt: reservation.createdAt ? new Date(reservation.createdAt) : undefined,
      updatedAt: reservation.updatedAt ? new Date(reservation.updatedAt) : undefined,
      actualCheckInTime: reservation.actualCheckInTime ? new Date(reservation.actualCheckInTime) : undefined,
      actualCheckOutTime: reservation.actualCheckOutTime ? new Date(reservation.actualCheckOutTime) : undefined,
      isCheckedOut: reservation.isCheckedOut || false,
    } as Reservation), []);

  const fetchDashboardData = useCallback(async () => {
      if (!propertyId) {
        setAllRooms([]);
        setAllReservations([]);
        setAvailabilitySettings([]);
        setRecentReservations([]);
        setTodaysArrivals([]);
        setTodaysDepartures([]);
        setIsDataLoading(false);
        return;
      }

      setIsDataLoading(true);

      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error("Authentication session expired. Please sign in again.");

        const roomsResponse = await fetch(`/api/rooms/list?propertyId=${propertyId}`, { headers });
        const roomsPayload = await roomsResponse.json();
        if (!roomsResponse.ok) {
          throw new Error(roomsPayload?.error || "Failed to fetch rooms.");
        }

        const roomsList: Room[] = Array.isArray(roomsPayload?.rooms) ? roomsPayload.rooms : [];
        setAllRooms(roomsList);

        const reservationsResponse = await fetch(`/api/reservations/list?propertyId=${propertyId}`, { headers });
        const reservationsPayload = await reservationsResponse.json();
        if (!reservationsResponse.ok) {
          throw new Error(reservationsPayload?.error || "Failed to fetch reservations.");
        }

        const reservationsList: Reservation[] = (Array.isArray(reservationsPayload?.reservations)
          ? reservationsPayload.reservations
          : [])
          .map(mapReservation);

        setAllReservations(reservationsList);

        const sortedByCreatedAt = [...reservationsList].sort((a, b) => {
          const aTime = toDate(a.createdAt)?.getTime() || 0;
          const bTime = toDate(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });
        setRecentReservations(sortedByCreatedAt.slice(0, MAX_RECENT_RESERVATIONS));

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        setTodaysArrivals(
          reservationsList.filter((reservation) => {
            const startDate = toDate(reservation.startDate);
            if (!startDate) return false;
            return isWithinInterval(startDate, { start: todayStart, end: todayEnd });
          })
        );
        setTodaysDepartures(
          reservationsList.filter((reservation) => {
            const endDate = toDate(reservation.endDate);
            if (!endDate) return false;
            return isWithinInterval(endDate, { start: todayStart, end: todayEnd });
          })
        );

        const rangeStart = startOfDay(dateRange?.from ?? new Date());
        const rangeEnd = endOfDay(dateRange?.to ?? dateRange?.from ?? new Date());
        const windowStart = format(rangeStart < todayStart ? rangeStart : todayStart, "yyyy-MM-dd");
        const windowEnd = format(rangeEnd > todayEnd ? rangeEnd : todayEnd, "yyyy-MM-dd");
        const roomIds = roomsList.map((room) => room.id).filter(Boolean);

        let availabilitySettingsList: AvailabilitySetting[] = [];
        if (roomIds.length > 0) {
          const params = new URLSearchParams({
            propertyId,
            minDate: windowStart,
            maxDate: windowEnd,
            roomIds: roomIds.join(","),
          });

          const availabilityResponse = await fetch(`/api/property-settings/rates-availability/calendar?${params.toString()}`, { headers });
          const availabilityPayload = await availabilityResponse.json();

          if (availabilityResponse.ok && Array.isArray(availabilityPayload?.availability)) {
            const roomTypeByRoomId = new Map(roomsList.map((room) => [room.id, room.roomTypeId]));
            availabilitySettingsList = availabilityPayload.availability.map((entry: any, index: number) => ({
              id: `${entry.room_id || entry.room_type_id || "availability"}-${entry.date}-${index}`,
              propertyId,
              roomTypeId: entry.room_type_id || roomTypeByRoomId.get(entry.room_id) || "",
              roomId: entry.room_id || null,
              startDate: entry.date,
              endDate: entry.end_date || entry.date,
              status: (
                String(entry.status || "").toLowerCase() === "available" ||
                entry.close_to_arrival === true ||
                entry.close_to_departure === true
              ) ? "available" : "blocked",
              notes: entry.notes || entry.reason || null,
              appliedDays: Array.isArray(entry.applied_days) ? entry.applied_days : null,
            }));
          }
        }

        setAvailabilitySettings(availabilitySettingsList);
      } catch (error: any) {
        console.error("Error loading dashboard data from Supabase:", error);
        setAllRooms([]);
        setAllReservations([]);
        setAvailabilitySettings([]);
        setRecentReservations([]);
        setTodaysArrivals([]);
        setTodaysDepartures([]);
      } finally {
        setIsDataLoading(false);
      }
  }, [propertyId, dateRange?.from, dateRange?.to, getAuthHeaders, mapReservation]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
    const blockedRoomIds = new Set<string>();

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

    // Check availability blocks for today.
    // Exclude: reservation-derived blocks (notes === 'occupied') — already excluded by mapping CTA/CTD as 'available'.
    // Include: stop_sell (not_available), manual blocks.
    availabilitySettings.forEach(setting => {
      if (
        setting.status === 'blocked' &&
        setting.notes !== 'occupied' &&
        isWithinInterval(today, { start: parseISO(setting.startDate), end: parseISO(setting.endDate) })
      ) {
        if (setting.roomId) {
          blockedRoomIds.add(setting.roomId);
          outOfServiceUnits.add(setting.roomId);
        } else if (setting.roomTypeId) {
          allRooms.forEach(room => {
            if (room.roomTypeId === setting.roomTypeId) {
              blockedRoomIds.add(room.id);
              outOfServiceUnits.add(room.id);
            }
          });
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
      blockedDates: blockedRoomIds.size
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
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No auth token');

      const res = await fetch('/api/reservations/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'checkIn',
          propertyId,
          reservationId: reservation.id,
          roomId: reservation.rooms[0].roomId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Check-in failed');
      }

      await fetchDashboardData();
      toast({title: t('toasts.check_in_success_title'), description: t('toasts.check_in_success_description', { roomName: reservation.rooms[0].roomName || '' })});
    } catch(err) {
      console.error("Error checking in:", err);
      toast({title: t('toasts.check_in_error_title'), description: t('toasts.check_in_error_description'), variant: "destructive"});
    }
  };

  const handleCheckOut = async (reservation: Reservation) => {
    if (!propertyId || !reservation.rooms?.[0]?.roomId || !canManageReservations || !user) return;
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No auth token');

      const roomDetails = allRooms.find(r => r.id === reservation.rooms[0].roomId);

      const res = await fetch('/api/reservations/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'checkOut',
          propertyId,
          reservationId: reservation.id,
          roomId: reservation.rooms[0].roomId,
          roomName: reservation.rooms[0].roomName,
          roomTypeName: reservation.rooms[0].roomTypeName,
          guestName: reservation.guestName,
          floor: roomDetails?.floor || 'N/A',
          createdByName: user.name || 'System',
          createdByUid: user.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Check-out failed');
      }

      await fetchDashboardData();
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
          onNewReservation={() => router.push('/reservations/new')} 
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

        {/* Recent Reservations */}
        <div className="grid grid-cols-1 gap-6">
          <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <History size={18} style={{ color: '#003166' }} />
              <h2 className="text-sm font-bold text-slate-800">{t('recent_reservations.title')}</h2>
            </div>

            <ReservationList
              reservations={recentReservations}
              isLoading={isDataLoading}
              onEditReservation={handleOpenReservationForm}
              onViewReservation={handleViewReservationDetails}
              onDeleteReservation={handleDeleteReservation}
              onCheckIn={() => {}}
              onCheckOut={() => {}}
              canManage={Boolean(canManageReservations)}
              propertyCurrency={propertySettings?.currency || "$"}
              currentPropertyId={propertyId}
              currentPage={1}
              totalPages={1}
              totalFilteredCount={recentReservations.length}
              onNextPage={() => {}}
              onPrevPage={() => {}}
              reservationsPerPage={MAX_RECENT_RESERVATIONS}
              onReservationsPerPageChange={() => {}}
              bulkActions={[]}
              propertySettings={propertySettings}
              hideCreateGuest
              hideDateBookedColumn
              mergeStayColumn
              hidePagination
            />

            <button
              onClick={() => router.push('/reservations/all')}
              className="w-full py-2.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
            >
              {t('recent_reservations.view_all_button')} <ChevronRight size={12} />
            </button>
          </section>
        </div>
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
