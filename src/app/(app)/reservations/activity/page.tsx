"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { Reservation } from "@/components/calendar/types";
import { format, startOfDay, endOfDay, isToday, parseISO } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { FirestoreUser } from '@/types/firestoreUser';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarIcon, PlusCircle, AlertCircle, BedDouble, LogIn, LogOut, UserCheck } from "lucide-react";
import ReservationStatusBadge from "@/components/reservations/reservation-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReservationDetailModal from "@/components/reservations/reservation-detail-modal";
import ReservationForm from "@/components/reservations/reservation-form";
import type { Property } from '@/types/property';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { Room } from "@/types/room";
import { useTranslation } from 'react-i18next';
import { Input } from "@/components/ui/input";
import PaymentStatusBadge from "@/components/payments/payment-status-badge";
import type { Payment } from '@/app/(app)/payments/page';

type ActivityStatus = "Arrivée" | "Départ" | "Présent" | "No-Show";

const getActivityStatus = (res: Reservation): ActivityStatus | null => {
    const today = new Date();
    if (res.status === 'No-Show' && isToday(res.startDate)) return "No-Show";
    if (isToday(res.endDate) && ['Checked-in', 'Confirmed', 'Pending', 'Completed'].includes(res.status)) return "Départ";
    if (res.status === 'Checked-in') {
        if (!isToday(res.endDate)) return "Présent";
    }
    if (['Confirmed', 'Pending'].includes(res.status) && isToday(res.startDate)) return "Arrivée";
    return null;
}

export default function ActivityPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t, i18n } = useTranslation(['pages/reservations/activity/content', 'pages/housekeeping/daily-tasks/content']);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [locale, setLocale] = React.useState(enUS);

  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Activities");

  const [selectedReservationForDetail, setSelectedReservationForDetail] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [isNewReservationModalOpen, setIsNewReservationModalOpen] = useState(false);

  React.useEffect(() => {
    setLocale(i18n.language === 'fr' ? fr : enUS);
  }, [i18n.language]);

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    } else if (user?.id) {
      const staffDocRef = doc(db, "staff", user.id);
      getDoc(staffDocRef).then(docSnap => {
        if (docSnap.exists()) setPropertyId((docSnap.data() as FirestoreUser).propertyId);
      });
    }
  }, [user]);

  useEffect(() => {
    if (propertyId) {
      const propDocRef = doc(db, "properties", propertyId);
      const unsubProp = onSnapshot(propDocRef, (docSnap) => {
        setPropertySettings(docSnap.exists() ? docSnap.data() as Property : null);
      });
      const roomsQuery = query(collection(db, "rooms"), where("propertyId", "==", propertyId));
      const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
        setAllRooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      });
      const paymentsQuery = query(collection(db, `properties/${propertyId}/payments`));
      const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
        setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      });

      return () => {
        unsubProp();
        unsubRooms();
        unsubPayments();
      };
    }
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const reservationsColRef = collection(db, "reservations");
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    
    const parseReservation = (d: any) => {
        const data = d.data();
        return {
            ...data, id: d.id,
            startDate: (data.startDate as Timestamp).toDate(),
            endDate: (data.endDate as Timestamp).toDate(),
            createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
            actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
            actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
        } as Reservation
    }

    // Query for arrivals (startDate is today)
    const arrivalsQuery = query(
      reservationsColRef,
      where("propertyId", "==", propertyId),
      where("startDate", ">=", Timestamp.fromDate(todayStart)),
      where("startDate", "<=", Timestamp.fromDate(todayEnd))
    );

    // Query for departures and in-house (endDate is today or future)
    const departuresQuery = query(
      reservationsColRef,
      where("propertyId", "==", propertyId),
      where("endDate", ">=", Timestamp.fromDate(todayStart))
    );

    const unsubArrivals = onSnapshot(arrivalsQuery, () => {}, (err) => {
      console.error("Error fetching arrivals:", err);
    });

    const unsubDepartures = onSnapshot(departuresQuery, (snapshot) => {
        const allRes = snapshot.docs.map(parseReservation);
        setAllReservations(allRes);
        setIsLoading(false);
    }, (err) => {
      console.error("Error fetching reservations:", err);
      toast({ title: t('toasts.error_fetching_reservations_title'), description: t('toasts.error_fetching_reservations_description'), variant: "destructive"});
      setIsLoading(false);
    });

    return () => {
      unsubArrivals();
      unsubDepartures();
    };
  }, [propertyId, t]);

  const { arrivals, departures, stayOvers, noShows, arrivalsCheckedIn, departuresCompleted } = useMemo(() => {
    const today = new Date();
    // Arrivals: ALL reservations starting today (regardless of status)
    const arrivalsCount = allReservations.filter(res => isToday(res.startDate) && res.status !== 'No-Show').length;
    // Already checked-in from arrivals
    const arrivalsCheckedInCount = allReservations.filter(res => isToday(res.startDate) && res.status === 'Checked-in').length;
    // Departures: ALL reservations ending today (regardless of status)
    const departuresCount = allReservations.filter(res => isToday(res.endDate) && ['Checked-in', 'Confirmed', 'Pending', 'Completed'].includes(res.status)).length;
    // Already completed from departures
    const departuresCompletedCount = allReservations.filter(res => isToday(res.endDate) && res.status === 'Completed').length;
    // In-House: Count actual guests from checked-in reservations not departing today
    const inHouseGuests = allReservations
      .filter(res => res.status === 'Checked-in' && !isToday(res.endDate))
      .reduce((sum, res) => sum + (Array.isArray(res.rooms) ? res.rooms.reduce((roomSum, r) => roomSum + ((r.adults || 0) + (r.children || 0)), 0) : 0), 0);
    const noShowsCount = allReservations.filter(res => isToday(res.startDate) && res.status === 'No-Show').length;
    
    return {
      arrivals: arrivalsCount,
      departures: departuresCount,
      stayOvers: inHouseGuests,
      noShows: noShowsCount,
      arrivalsCheckedIn: arrivalsCheckedInCount,
      departuresCompleted: departuresCompletedCount,
    }
  }, [allReservations]);

  const filteredReservations = useMemo(() => {
    return allReservations
      .map(res => ({ ...res, activityStatus: getActivityStatus(res) }))
      .filter(res => res.activityStatus)
      .filter(res => {
        if (statusFilter === 'All Activities') return true;
        return res.activityStatus === statusFilter;
      })
      .filter(res => {
        if (!searchQuery.trim()) return true;
        const search = searchQuery.toLowerCase();
        return (
          res.guestName?.toLowerCase().includes(search) ||
          res.id.toLowerCase().includes(search) ||
          res.reservationNumber?.toLowerCase().includes(search) ||
          res.rooms.some(r => r.roomName?.toLowerCase().includes(search))
        );
      });
  }, [allReservations, statusFilter, searchQuery]);

  const calculateTotalPaid = useCallback((reservationId: string) => {
    return payments.filter(p => p.reservationId === reservationId && p.status !== 'Pending')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);
  
  const dirtyRoomsCount = useMemo(() => allRooms.filter(r => r.status === 'Dirty').length, [allRooms]);

  const handleCheckIn = async (reservationId: string) => {
    try {
      // Check if reservation is canceled
      const reservation = allReservations.find(r => r.id === reservationId);
      if (reservation?.status === 'Canceled') {
        toast({title: "Cannot Check In", description: "Canceled reservations cannot be checked in.", variant: "destructive"});
        return;
      }
      
      await updateDoc(doc(db, "reservations", reservationId), { 
        status: 'Checked-in',
        actualCheckInTime: serverTimestamp(), 
      });
      toast({title: t('toasts.check_in_success_title'), description: t('toasts.check_in_success_description')});
    } catch(err) {
      toast({title: t('toasts.check_in_error_title'), description: t('toasts.check_in_error_description'), variant: "destructive"});
    }
  };

  const handleCheckOut = async (reservation: Reservation) => {
    if (!propertyId || !reservation.rooms?.[0]?.roomId || !user) return;
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
  
  if (isLoadingAuth) return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  if (!user?.permissions?.reservations) return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied_title')}</AlertTitle>
        <AlertDescription>{t('access_denied_description')}</AlertDescription>
      </Alert>
  );

  const filterPills: { label: string, value: ActivityStatus | 'All Activities' }[] = [
    { label: t('filters.all'), value: 'All Activities' },
    { label: t('filters.arrivals'), value: 'Arrivée' },
    { label: t('filters.departures'), value: 'Départ' },
    { label: t('filters.in_house'), value: 'Présent' },
    { label: t('filters.no_shows'), value: 'No-Show' },
  ];

  return (
    <div className="flex flex-col space-y-6 w-full max-w-full overflow-hidden">
      {/* 1. Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 w-full">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t('header.title')}</h1>
          <Badge variant="outline" className="text-sm font-semibold whitespace-nowrap">{format(new Date(), 'PP', { locale })}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/reservations/calendar">
            <Button variant="outline" className="whitespace-nowrap"><CalendarIcon className="mr-2 h-4 w-4" />{t('header.calendar_view')}</Button>
          </Link>
          <Button onClick={() => setIsNewReservationModalOpen(true)} className="whitespace-nowrap">
            <PlusCircle className="mr-2 h-4 w-4" />{t('header.new_reservation')}
          </Button>
        </div>
      </div>

      {/* 2. Key Performance Indicators (KPIs) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 w-full">
        <KpiCard 
          title={t('kpis.arrivals')} 
          value={arrivals} 
          icon={<LogIn className="h-5 w-5 text-emerald-600" />} 
          borderColor="border-emerald-500" 
          bgColor="bg-emerald-50"
          detailText={`${arrivalsCheckedIn} checked-in, ${arrivals - arrivalsCheckedIn} pending`}
          detailColor="text-emerald-600"
        />
        <KpiCard 
          title={t('kpis.departures')} 
          value={departures} 
          icon={<LogOut className="h-5 w-5 text-blue-600" />} 
          borderColor="border-blue-500" 
          bgColor="bg-blue-50"
          detailText={`${departuresCompleted} completed, ${departures - departuresCompleted} pending`}
          detailColor="text-blue-600"
        />
        <KpiCard 
          title="In-House" 
          value={stayOvers} 
          icon={<BedDouble className="h-5 w-5 text-orange-600" />} 
          borderColor="border-orange-500" 
          bgColor="bg-orange-50"
          detailText={stayOvers > 0 ? `${stayOvers} guest${stayOvers !== 1 ? 's' : ''} checked-in` : "No guests"}
          detailColor="text-orange-600"
        />
        <KpiCard 
          title={t('kpis.no_shows')} 
          value={noShows} 
          icon={<UserCheck className="h-5 w-5 text-rose-600" />} 
          borderColor="border-rose-500" 
          bgColor="bg-rose-50"
          detailText={noShows > 0 ? "No-show reservations" : "No incidents"}
          detailColor="text-rose-600"
        />
      </div>

      {/* 3. Advanced Filtering & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
        <Input 
          placeholder={t('filters.search_placeholder')} 
          className="max-w-sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {filterPills.map(pill => (
            <Button 
              key={pill.value} 
              variant={statusFilter === pill.value ? "default" : "outline"}
              onClick={() => setStatusFilter(pill.value)}
              className="shrink-0"
            >
              {pill.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 4. Operational Guest List */}
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-medium border-b border-slate-200 bg-slate-50/30">
                  <th className="py-3 px-4 border-r border-slate-200">{t('table.res_no')}</th>
                  <th className="py-3 px-4 border-r border-slate-200">{t('table.guest')}</th>
                  <th className="py-3 px-4 border-r border-slate-200">Date Booked</th>
                  <th className="py-3 px-4 border-r border-slate-200">{t('table.room')}</th>
                  <th className="py-3 px-4 border-r border-slate-200">Check-in</th>
                  <th className="py-3 px-4 border-r border-slate-200">Check-out</th>
                  <th className="py-3 px-4 border-r border-slate-200">Nights</th>
                  <th className="py-3 px-4 border-r border-slate-200">{t('table.total')}</th>
                  <th className="py-3 px-4 border-r border-slate-200">{t('table.status')}</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr><td colSpan={10} className="h-48 text-center py-4"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                ) : filteredReservations.length > 0 ? (
                  filteredReservations.map(res => {
                    const totalPaid = calculateTotalPaid(res.id);
                    const totalGuests = Array.isArray(res.rooms) ? res.rooms.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0) : 0;
                    const nights = Math.ceil((new Date(res.endDate).getTime() - new Date(res.startDate).getTime()) / (1000 * 60 * 60 * 24));
                    const checkInDate = format(res.startDate, 'dd/MM/yy', { locale });
                    const checkOutDate = format(res.endDate, 'dd/MM/yy', { locale });
                    const bookingDate = format(res.createdAt, 'dd/MM/yy', { locale });
                    const bookingTime = format(res.createdAt, 'HH:mm', { locale });

                    return (
                    <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="font-medium text-slate-800 font-mono text-xs">{res.reservationNumber || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="font-bold text-slate-800">{res.guestName}</div>
                        <div className="text-[10px] text-slate-400">{totalGuests} guest{totalGuests !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="text-sm text-slate-800 font-medium">{bookingDate}</div>
                        <div className="text-xs text-slate-500">{bookingTime}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="font-medium text-slate-800">{Array.isArray(res.rooms) && res.rooms[0] ? res.rooms[0].roomName : 'N/A'}</div>
                        <div className="text-xs text-slate-500">{Array.isArray(res.rooms) && res.rooms[0] ? res.rooms[0].roomTypeName : ''}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="text-sm text-slate-800">{checkInDate}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="text-sm text-slate-800">{checkOutDate}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="text-sm text-slate-800">{nights} night{nights !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="text-sm font-semibold text-slate-800">{propertySettings?.currency || '$'}{(res.totalPrice || 0).toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <ReservationStatusBadge status={res.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {res.activityStatus === 'Arrivée' && !res.actualCheckInTime && res.status !== 'Canceled' && (
                            <Button size="sm" onClick={() => handleCheckIn(res.id)} className="text-xs">{t('actions.check_in')}</Button>
                          )}
                          {res.activityStatus === 'Départ' && !res.actualCheckOutTime && (
                            <Button size="sm" variant="outline" onClick={() => handleCheckOut(res)} className="text-xs">{t('actions.check_out')}</Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-slate-400 hover:text-slate-600">
                                <Icons.MoreVertical size={18} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setSelectedReservationForDetail(res)}>
                                <Icons.Eye className="mr-2 h-4 w-4" />{t('actions.view')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingReservation(res)}>
                                <Icons.Edit className="mr-2 h-4 w-4" />{t('actions.edit')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={10} className="h-24 text-center text-slate-500 py-4">{t('table.no_results')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* 5. Housekeeping Integration */}
      <div className="bg-slate-800 text-white rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
          <div>
            <h4 className="font-bold">{t('housekeeping.title')}</h4>
            <p className="text-sm text-slate-300">{t('housekeeping.subtitle', { count: dirtyRoomsCount })}</p>
          </div>
        </div>
        <Link href="/housekeeping/daily-tasks">
          <Button variant="secondary" className="whitespace-nowrap">{t('housekeeping.go_to_housekeeping')}</Button>
        </Link>
      </div>

      {/* Modals */}
      {selectedReservationForDetail && (
        <ReservationDetailModal
          isOpen={!!selectedReservationForDetail}
          onClose={() => setSelectedReservationForDetail(null)}
          initialData={selectedReservationForDetail}
          propertySettings={propertySettings}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          canManage={true}
          onEdit={(res) => { setSelectedReservationForDetail(null); setEditingReservation(res); }}
        />
      )}
      <Dialog open={!!editingReservation} onOpenChange={(isOpen) => !isOpen && setEditingReservation(null)}>
        <DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{t('modals.edit_reservation.title')}</DialogTitle></DialogHeader><ReservationForm onClose={() => setEditingReservation(null)} initialData={editingReservation} /></DialogContent>
      </Dialog>
      <Dialog open={isNewReservationModalOpen} onOpenChange={setIsNewReservationModalOpen}>
        <DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{t('modals.new_reservation.title')}</DialogTitle></DialogHeader><ReservationForm onClose={() => setIsNewReservationModalOpen(false)} /></DialogContent>
      </Dialog>
    </div>
  );
}

const KpiCard = ({ title, value, icon, borderColor, bgColor, detailText, detailColor }: { title: string, value: number, icon: React.ReactNode, borderColor: string, bgColor: string, detailText?: string, detailColor?: string }) => (
  <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${borderColor} transition-transform hover:-translate-y-1`}>
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
        {detailText && (
          <p className={`text-[10px] font-semibold mt-2 ${detailColor || 'text-slate-500'}`}>{detailText}</p>
        )}
      </div>
      <div className={`p-2 rounded-lg ${bgColor}`}>
        {icon}
      </div>
    </div>
  </div>
);
