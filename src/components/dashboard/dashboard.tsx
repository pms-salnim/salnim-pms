

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { useAuth } from "@/contexts/auth-context";
import { db, app } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, writeBatch, limit, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Reservation } from "@/components/calendar/types";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, differenceInDays, addDays, isToday } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import type { FirestoreUser } from '@/types/firestoreUser';
import CheckAvailabilityCard from "@/components/dashboard/check-availability-card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ReservationForm from "@/components/reservations/reservation-form";
import ReservationDetailModal from "@/components/reservations/reservation-detail-modal";
import { toast } from '@/hooks/use-toast';
import type { Property } from "@/types/property";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal } from "lucide-react";
import ReservationStatusBadge from "@/components/reservations/reservation-status-badge";
import type { Room } from "@/types/room";
import { useTranslation } from 'react-i18next';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


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
                setDateRange({ from: startOfWeek(today, { locale }), to: endOfWeek(today, { locale }) });
                break;
            case 'this_month':
                setDateRange({ from: startOfMonth(today), to: endOfDay(today) });
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


export default function DashboardPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t: tForm } = useTranslation('pages/dashboard/reservation-form');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);

  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);

  const [recentReservations, setRecentReservations] = useState<Reservation[]>([]);
  const [todaysArrivals, setTodaysArrivals] = useState<Reservation[]>([]);
  const [todaysDepartures, setTodaysDepartures] = useState<Reservation[]>([]);
  
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
  
  const [refundDialogInfo, setRefundDialogInfo] = useState<{ reservationId: string; reservation: Reservation; shouldRefund: boolean; refundAmount: number } | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const canManageReservations = user?.permissions?.reservations;
  const { t, i18n } = useTranslation(['pages/dashboard/content']);
  const [locale, setLocale] = useState(enUS);

  useEffect(() => {
    setLocale(i18n.language === 'fr' ? fr : enUS);
  }, [i18n.language]);

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
  }, [propertyId]);

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
        startDate: (data.startDate as Timestamp).toDate(),
        endDate: (data.endDate as Timestamp).toDate(),
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
        actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
        actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
        isCheckedOut: data.isCheckedOut || false,
      } as Reservation;
    };

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const unsubAllRooms = onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", propertyId)), (snap) => setAllRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room))));
    const unsubAllReservations = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId)), (snap) => {
        setAllReservations(snap.docs.map(parseReservation));
        setIsDataLoading(false); 
    });
    const unsubRecentReservations = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), orderBy("createdAt", "desc"), limit(10)), (snap) => setRecentReservations(snap.docs.map(parseReservation)));
    const unsubTodaysArrivals = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), where("startDate", ">=", todayStart), where("startDate", "<=", todayEnd)), (snap) => setTodaysArrivals(snap.docs.map(parseReservation)));
    const unsubTodaysDepartures = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), where("endDate", ">=", todayStart), where("endDate", "<=", todayEnd)), (snap) => setTodaysDepartures(snap.docs.map(parseReservation)));

    return () => {
      unsubAllRooms();
      unsubAllReservations();
      unsubRecentReservations();
      unsubTodaysArrivals();
      unsubTodaysDepartures();
    };
  }, [propertyId]);
  
  const dashboardMetrics = useMemo(() => {
    const metrics = {
        totalReservations: 0,
        checkIns: 0,
        checkOuts: 0,
        inHouseGuests: 0,
        occupancyRate: 0,
        stayRevenue: 0,
        occupiedRooms: 0,
    };

    if (!allReservations.length || !dateRange?.from) return metrics;

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    metrics.totalReservations = allReservations.filter(res => 
      res.createdAt && isWithinInterval(res.createdAt, { start: rangeStart, end: rangeEnd }) && res.status !== 'Canceled' && res.status !== 'No-Show'
    ).length;
    
    metrics.checkIns = allReservations.filter(res => 
      isWithinInterval(res.startDate, { start: rangeStart, end: rangeEnd })
    ).length;

    metrics.checkOuts = allReservations.filter(res => 
      isWithinInterval(res.endDate, { start: rangeStart, end: rangeEnd })
    ).length;
    
    const now = new Date();
    const inHouseReservations = allReservations.filter(res => {
        if (res.status === 'Canceled' || res.status === 'No-Show') return false;
        const resStart = startOfDay(res.startDate);
        const resEnd = startOfDay(res.endDate);
        return now >= resStart && now < resEnd && !!res.actualCheckInTime && !res.isCheckedOut;
    });

    metrics.inHouseGuests = inHouseReservations.reduce((sum, res) => sum + (res.adults || 0) + (res.children || 0), 0);
    const occupiedRoomsToday = inHouseReservations.length;
    metrics.occupiedRooms = occupiedRoomsToday;
    
    if (allRooms.length > 0) {
      metrics.occupancyRate = (occupiedRoomsToday / allRooms.length) * 100;
    }

    // --- New Stay-Based Revenue Calculation ---
    let totalRevenueForStays = 0;
    const revenueGeneratingStays = allReservations.filter(res =>
      (res.status === 'Confirmed' || res.status === 'Checked-in' || res.status === 'Completed') &&
      startOfDay(res.startDate) <= rangeEnd &&
      startOfDay(res.endDate) > rangeStart // Overlaps the range
    );
    
    revenueGeneratingStays.forEach(res => {
        const totalNightsForRes = differenceInDays(res.endDate, res.startDate);
        if (totalNightsForRes > 0) {
            const netAmount = res.netAmount ?? ((res.totalPrice || 0) - (res.taxAmount || 0));
            const revenuePerNight = netAmount / totalNightsForRes;
            const daysInStay = eachDayOfInterval({ start: res.startDate, end: addDays(res.endDate, -1) });
            daysInStay.forEach(dayOfStay => {
                if (isWithinInterval(dayOfStay, { start: rangeStart, end: rangeEnd })) {
                    totalRevenueForStays += revenuePerNight;
                }
            });
        }
    });

    metrics.stayRevenue = totalRevenueForStays;

    return metrics;
  }, [allReservations, allRooms, dateRange]);


  const handleCheckIn = async (reservationId: string) => {
    if (!propertyId || !canManageReservations) return;
    try {
      await updateDoc(doc(db, "reservations", reservationId), { 
        status: 'Checked-in',
        actualCheckInTime: serverTimestamp(), 
        isCheckedOut: false 
      });
      toast({title: t('toasts.check_in_success_title'), description: t('toasts.check_in_success_description')});
    } catch(err) {
      toast({title: t('toasts.check_in_error_title'), description: t('toasts.check_in_error_description'), variant: "destructive"});
    }
  };

  const handleCheckOut = async (reservation: Reservation) => {
    if (!propertyId || !reservation.roomId || !canManageReservations || !user) return;
    try {
      const roomDetails = allRooms.find(r => r.id === reservation.roomId);

      const batch = writeBatch(db);
      
      batch.update(doc(db, "reservations", reservation.id), { 
        status: 'Completed',
        actualCheckOutTime: serverTimestamp(), 
        isCheckedOut: true 
      });
      
      batch.update(doc(db, "rooms", reservation.roomId), { status: 'Dirty' });

      const newTaskRef = doc(collection(db, 'tasks'));
      const taskPayload = {
          id: newTaskRef.id,
          title: `Clean ${reservation.roomName}`,
          description: `Room ${reservation.roomName} - Guest: ${reservation.guestName}`,
          property_id: propertyId,
          room_id: reservation.roomId,
          roomName: reservation.roomName,
          roomTypeName: reservation.roomTypeName,
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
      toast({title: t('toasts.check_out_success_title'), description: t('toasts.check_out_success_description', { roomName: reservation.roomName || '' })});
    } catch(err) {
      console.error("Error checking out:", err);
      toast({title: t('toasts.check_out_error_title'), description: t('toasts.check_out_error_description'), variant: "destructive"});
    }
  };

  const metricCards = [
    { title: t('metric_cards.total_reservations.title'), value: dashboardMetrics.totalReservations, icon: Icons.CalendarCheck, dataAiHint: "calendar checkmark", description: t('metric_cards.total_reservations.description') },
    { title: t('metric_cards.check_ins.title'), value: dashboardMetrics.checkIns, icon: Icons.LogIn, dataAiHint: "door enter", description: t('metric_cards.check_ins.description') },
    { title: t('metric_cards.check_outs.title'), value: dashboardMetrics.checkOuts, icon: Icons.LogOut, dataAiHint: "door exit", description: t('metric_cards.check_outs.description') },
    { title: t('metric_cards.in_house_guests.title'), value: dashboardMetrics.inHouseGuests, icon: Icons.Users, dataAiHint: "group people", description: t('metric_cards.in_house_guests.description') },
    { title: t('metric_cards.occupancy_rate.title'), value: `${dashboardMetrics.occupancyRate.toFixed(1)}%`, icon: Icons.TrendingUp, dataAiHint: "graph arrow up", description: t('metric_cards.occupancy_rate.description') },
    { title: t('metric_cards.revenue.title'), value: `${propertySettings?.currency || '$'}${dashboardMetrics.stayRevenue.toFixed(2)}`, icon: Icons.DollarSign, dataAiHint: "money revenue", description: t('metric_cards.revenue.description') },
    { title: t('metric_cards.available_rooms.title'), value: allRooms.length - Math.round(allRooms.length * (dashboardMetrics.occupancyRate/100)), icon: Icons.BedDouble, dataAiHint: "hotel bed available", description: t('metric_cards.available_rooms.description') },
    { title: t('metric_cards.occupied_rooms.title'), value: dashboardMetrics.occupiedRooms, icon: Icons.BedDouble, dataAiHint: "hotel bed occupied", description: t('metric_cards.occupied_rooms.description') },
  ];

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

  const handleCancelReservation = (reservation: Reservation) => {
    if (!canManageReservations) return;
    const totalPrice = reservation.totalPrice || 0;
    setRefundDialogInfo({
      reservationId: reservation.id,
      reservation,
      shouldRefund: true,
      refundAmount: totalPrice
    });
    setIsRefundDialogOpen(true);
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

  const handleRefundDialogConfirm = async () => {
    if (!refundDialogInfo || !propertyId) return;

    setIsProcessing(true);
    try {
      if (refundDialogInfo.shouldRefund && refundDialogInfo.refundAmount > 0) {
        const paymentsRef = collection(db, `properties/${propertyId}/payments`);
        const paymentQuery = query(paymentsRef, where("reservationId", "==", refundDialogInfo.reservationId), limit(1));
        const paymentSnap = await getDocs(paymentQuery);
        
        if (paymentSnap.docs.length > 0) {
          const functions = getFunctions(app, 'us-central1');
          const createRefund = httpsCallable(functions, 'createRefund');
          
          await createRefund({
            propertyId: propertyId,
            originalPaymentId: paymentSnap.docs[0].id,
            refundAmount: refundDialogInfo.refundAmount,
            reason: "Reservation canceled by user"
          });
        }
      }

      const batch = writeBatch(db);
      batch.update(doc(db, "reservations", refundDialogInfo.reservationId), {
        status: 'Canceled',
        updatedAt: serverTimestamp(),
        refundedAmount: refundDialogInfo.shouldRefund ? refundDialogInfo.refundAmount : 0,
      });
      await batch.commit();

      const currencySymbol = propertySettings?.currency ? propertySettings.currency : '$';
      toast({
        title: "Reservation Canceled",
        description: refundDialogInfo.shouldRefund
          ? `Reservation canceled. Refund of ${currencySymbol}${refundDialogInfo.refundAmount.toFixed(2)} approved.`
          : "Reservation canceled. No refund issued.",
      });
      
      setIsRefundDialogOpen(false);
      setRefundDialogInfo(null);
    } catch (error: any) {
      console.error("Error canceling reservation:", error);
      toast({
        title: "Error",
        description: "Failed to cancel reservation.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex items-center gap-4">
            <DateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
            <Button onClick={() => handleOpenReservationForm(null)} disabled={!propertyId || !canManageReservations}>
                <Icons.FilePlus2 className="mr-2 h-4 w-4" />
                {t('new_booking_button')}
            </Button>
        </div>
      </header>

      <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metricCards.map((metric) => {
              const IconComponent = metric.icon;
              return (
                <Card key={metric.title} className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {metric.title}
                    </CardTitle>
                    <IconComponent className="h-4 w-4 text-muted-foreground" data-ai-hint={metric.dataAiHint} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      {isDataLoading ? <Icons.Spinner className="h-5 w-5 animate-spin" /> : metric.value}
                    </div>
                    {metric.description && <p className="text-xs text-muted-foreground pt-1">{metric.description}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <Card className="w-full shadow-sm">
            <CardHeader>
              <CardTitle>{t('todays_activity.title')}</CardTitle>
              <CardDescription>{t('todays_activity.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Icons.LogIn className="mr-2 h-5 w-5 text-green-500" />
                    {t('todays_activity.check_ins.title')} ({todaysArrivals.length})
                  </h3>
                  {isDataLoading ? (
                     <div className="flex items-center justify-center py-8"> <Icons.Spinner className="h-5 w-5 animate-spin"/> <span className="ml-2">{t('loading')}</span></div>
                  ) : todaysArrivals.length > 0 ? (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('todays_activity.check_ins.table.guest')}</TableHead>
                            <TableHead>{t('todays_activity.check_ins.table.details')}</TableHead>
                            <TableHead className="text-right">{t('todays_activity.check_ins.table.total')}</TableHead>
                            <TableHead>{t('todays_activity.check_ins.table.status')}</TableHead>
                            <TableHead>{t('todays_activity.check_ins.table.payment')}</TableHead>
                            <TableHead className="text-center">{t('todays_activity.check_ins.table.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todaysArrivals.slice(0, 5).map(res => {
                            const paymentStatusDisplay = res.paymentStatus || "Pending";
                            return (
                              <TableRow key={res.id}>
                                <TableCell className="font-medium text-foreground">{res.guestName}</TableCell>
                                <TableCell>
                                    <div className="font-medium text-sm">{res.roomTypeName}{res.roomName ? ` - ${res.roomName}` : ''}</div>
                                    <div className="text-xs text-muted-foreground">{format(res.startDate, "PP")} to {format(res.endDate, "PP")}</div>
                                </TableCell>
                                <TableCell className="text-right font-medium">{propertySettings?.currency || '$'}{(res.totalPrice || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <ReservationStatusBadge status={res.status} />
                                    {!!res.actualCheckInTime && (
                                      <p className="text-xs text-green-600 flex items-center mt-1">
                                        <Icons.CheckCircle2 className="mr-1 h-3 w-3" />
                                        {t('todays_activity.check_ins.checked_in_badge')}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                      variant={paymentStatusDisplay === "Paid" ? "default" : "outline"}
                                      className={cn(
                                          "capitalize text-xs h-5 px-1.5 py-0.5",
                                          paymentStatusDisplay === "Paid" ? "bg-green-100 text-green-700 border-green-300" :
                                          paymentStatusDisplay === "Pending" ? "border-yellow-500 text-yellow-700" :
                                          paymentStatusDisplay === "Partial" ? "border-blue-500 text-blue-700" : ""
                                      )}
                                  >
                                      {paymentStatusDisplay}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-x-1">
                                    <Button size="sm" onClick={() => handleCheckIn(res.id)} disabled={!!res.actualCheckInTime || res.status === 'Canceled' || !canManageReservations}>
                                      {t('todays_activity.check_ins.check_in_button')}
                                    </Button>
                                    {canManageReservations && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">{t('todays_activity.actions_menu.label')}</span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => handleViewReservationDetails(res)}>
                                            <Icons.Eye className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.view')}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleOpenReservationForm(res)}>
                                            <Icons.Edit className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.edit')}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCancelReservation(res); }} className="text-red-600">
                                            <Icons.X className="mr-2 h-4 w-4" /> Cancel
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">{t('todays_activity.check_ins.no_arrivals')}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Icons.LogOut className="mr-2 h-5 w-5 text-blue-500" />
                    {t('todays_activity.check_outs.title')} ({todaysDepartures.length})
                  </h3>
                  {isDataLoading ? (
                     <div className="flex items-center justify-center py-8"> <Icons.Spinner className="h-5 w-5 animate-spin"/> <span className="ml-2">{t('loading')}</span></div>
                  ) : todaysDepartures.length > 0 ? (
                     <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('todays_activity.check_outs.table.guest')}</TableHead>
                            <TableHead>{t('todays_activity.check_outs.table.details')}</TableHead>
                            <TableHead className="text-right">{t('todays_activity.check_outs.table.total')}</TableHead>
                            <TableHead>{t('todays_activity.check_outs.table.status')}</TableHead>
                            <TableHead>{t('todays_activity.check_outs.table.payment')}</TableHead>
                            <TableHead className="text-center">{t('todays_activity.check_outs.table.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todaysDepartures.slice(0, 5).map(res => {
                             const paymentStatusDisplay = res.paymentStatus || "Pending";
                             return (
                               <TableRow key={res.id}>
                                <TableCell className="font-medium text-foreground">{res.guestName}</TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">{res.roomTypeName}{res.roomName ? ` - ${res.roomName}` : ''}</div>
                                  <div className="text-xs text-muted-foreground">{format(res.startDate, "PP")} to {format(res.endDate, "PP")}</div>
                                </TableCell>
                                <TableCell className="text-right font-medium">{propertySettings?.currency || '$'}{(res.totalPrice || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <ReservationStatusBadge status={res.status} />
                                     {res.isCheckedOut && (
                                      <p className="text-xs text-red-600 flex items-center mt-1">
                                        <Icons.CheckCircle2 className="mr-1 h-3 w-3" />
                                        {t('todays_activity.check_outs.completed_badge')}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                      variant={paymentStatusDisplay === "Paid" ? "default" : "outline"}
                                      className={cn(
                                          "capitalize text-xs h-5 px-1.5 py-0.5",
                                          paymentStatusDisplay === "Paid" ? "bg-green-100 text-green-700 border-green-300" :
                                          paymentStatusDisplay === "Pending" ? "border-yellow-500 text-yellow-700" :
                                          paymentStatusDisplay === "Partial" ? "border-blue-500 text-blue-700" : ""
                                      )}
                                  >
                                      {paymentStatusDisplay}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-x-1">
                                    <Button size="sm" onClick={() => handleCheckOut(res)} disabled={!!res.actualCheckOutTime || res.status === 'Canceled' || !canManageReservations}>
                                      {t('todays_activity.check_outs.check_out_button')}
                                    </Button>
                                    {canManageReservations && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">{t('todays_activity.actions_menu.label')}</span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => handleViewReservationDetails(res)}>
                                            <Icons.Eye className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.view')}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleOpenReservationForm(res)}>
                                            <Icons.Edit className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.edit')}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCancelReservation(res); }} className="text-red-600">
                                            <Icons.X className="mr-2 h-4 w-4" /> Cancel
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                             );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">{t('todays_activity.check_outs.no_departures')}</p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/reservations/activity">{t('todays_activity.show_all_button')}</Link>
              </Button>
            </CardFooter>
          </Card>

          <CheckAvailabilityCard
            propertyId={propertyId}
            propertySettings={propertySettings}
            onBook={canManageReservations ? handleOpenReservationForm : undefined}
          />

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t('recent_reservations.title')}</CardTitle>
              <CardDescription>{t('recent_reservations.description')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isDataLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Icons.Spinner className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : recentReservations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('recent_reservations.table.guest')}</TableHead>
                      <TableHead>{t('recent_reservations.table.room')}</TableHead>
                      <TableHead>{t('recent_reservations.table.dates')}</TableHead>
                      <TableHead className="text-right">{t('recent_reservations.table.total')}</TableHead>
                      <TableHead>{t('recent_reservations.table.status')}</TableHead>
                      <TableHead className="text-right">{t('recent_reservations.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentReservations.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div className="font-medium">{booking.guestName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{booking.reservationNumber}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{booking.roomName}</div>
                          <div className="text-xs text-muted-foreground">{booking.roomTypeName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{format(booking.startDate, "PP")}</div>
                          <div className="text-xs text-muted-foreground">to {format(booking.endDate, "PP")}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{propertySettings?.currency || '$'}{(booking.totalPrice || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <ReservationStatusBadge status={booking.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">{t('todays_activity.actions_menu.label')}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewReservationDetails(booking)}>
                                <Icons.Eye className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.view')}
                              </DropdownMenuItem>
                              {canManageReservations && (
                                <>
                                  <DropdownMenuItem onClick={() => handleOpenReservationForm(booking)}>
                                    <Icons.Edit className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteReservation(booking.id)} className="text-destructive">
                                    <Icons.Trash className="mr-2 h-4 w-4" /> {t('todays_activity.actions_menu.delete')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">{t('recent_reservations.no_reservations')}</p>
              )}
            </CardContent>
            <CardFooter className="justify-end border-t pt-4 mt-2">
              <Button size="sm" variant="outline" asChild>
                  <Link href="/reservations/all">{t('recent_reservations.view_all_button')}</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>


      {/* Edit/Create Reservation Modal */}
      <Dialog open={isReservationFormModalOpen} onOpenChange={(isOpen) => { setIsReservationFormModalOpen(isOpen); if(!isOpen) setEditingReservation(null); }}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
              <DialogTitle>{editingReservation?.id ? tForm('edit_title') : tForm('create_title')}</DialogTitle>
              <DialogDescription>{editingReservation?.id ? tForm('edit_description') : tForm('create_description')}</DialogDescription>
          </DialogHeader>
          <ReservationForm
            onClose={() => { setIsReservationFormModalOpen(false); setEditingReservation(null); }}
            initialData={editingReservation as Reservation | null}
          />
        </DialogContent>
      </Dialog>

      {/* Reservation Detail Modal */}
      {selectedReservationForDetail && (
        <ReservationDetailModal
          isOpen={isReservationDetailModalOpen}
          onClose={() => {
            setIsReservationDetailModalOpen(false);
            setSelectedReservationForDetail(null);
          }}
          reservation={selectedReservationForDetail}
          propertySettings={propertySettings}
          onEdit={handleEditFromDetailModal}
          canManage={canManageReservations}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      )}

      {/* Delete Confirmation Dialog */}
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

      {/* Refund Dialog */}
      <AlertDialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancellation & Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Guest: {refundDialogInfo?.reservation.guestName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 my-4">
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Reservation Total:</span>
                <span className="text-lg font-bold">{propertySettings?.currency || '$'}{refundDialogInfo?.reservation.totalPrice?.toFixed(2)}</span>
              </div>
              
              <div className="border-t pt-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={refundDialogInfo?.shouldRefund ?? true}
                    onChange={(e) => {
                      if (refundDialogInfo) {
                        setRefundDialogInfo({
                          ...refundDialogInfo,
                          shouldRefund: e.target.checked,
                          refundAmount: e.target.checked ? refundDialogInfo.reservation.totalPrice || 0 : 0
                        });
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Issue Refund</p>
                    <p className="text-xs text-slate-600">
                      {refundDialogInfo?.shouldRefund 
                        ? "Guest will receive a refund"
                        : "Guest will not receive a refund"
                      }
                    </p>
                  </div>
                </label>
              </div>

              {refundDialogInfo?.shouldRefund && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Refund Amount
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{propertySettings?.currency || '$'}</span>
                    <input
                      type="number"
                      min="0"
                      max={refundDialogInfo?.reservation.totalPrice || 0}
                      step="0.01"
                      value={refundDialogInfo?.refundAmount.toFixed(2)}
                      onChange={(e) => {
                        if (refundDialogInfo) {
                          const amount = Math.min(Math.max(0, parseFloat(e.target.value) || 0), refundDialogInfo.reservation.totalPrice || 0);
                          setRefundDialogInfo({
                            ...refundDialogInfo,
                            refundAmount: amount
                          });
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    Max: {propertySettings?.currency || '$'}{refundDialogInfo?.reservation.totalPrice?.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                <p className="text-sm text-yellow-800">
                  <strong>Payment Status:</strong> {refundDialogInfo?.reservation.paymentStatus}
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsRefundDialogOpen(false);
              setRefundDialogInfo(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRefundDialogConfirm} 
              disabled={isProcessing}
              className={refundDialogInfo?.shouldRefund ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isProcessing && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {refundDialogInfo?.shouldRefund ? "Confirm Cancellation & Refund" : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    
