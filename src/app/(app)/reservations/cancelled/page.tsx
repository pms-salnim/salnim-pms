
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import ReservationFilters from "@/components/reservations/reservation-filters";
import ExportReservationsButton from "@/components/reservations/export-reservations-button";
import ReservationList from "@/components/reservations/reservation-list";
import ReservationForm from "@/components/reservations/reservation-form";
import ReservationDetailModal from "@/components/reservations/reservation-detail-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { toast } from '@/hooks/use-toast';
import type { Reservation, ReservationStatus } from '@/components/calendar/types';
import type { ReservationDisplayStatus } from '@/components/reservations/reservation-status-badge';
import type { FirestoreUser } from '@/types/firestoreUser';
import type { Property } from '@/types/property';
import type { RoomType } from '@/types/roomType';
import type { DateRange } from 'react-day-picker';
import { startOfDay } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function CancelledReservationsPage() {
  const { user, isLoadingAuth } = useAuth();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalReservationsInRange, setTotalReservationsInRange] = useState<number | null>(null);
  const [paymentsForRange, setPaymentsForRange] = useState<any[]>([]);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Filter states - Note: Status filter is pre-set for this page
  const [searchTerm, setSearchTerm] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);
  const [cancellationDateRange, setCancellationDateRange] = useState<DateRange | undefined>(undefined);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [bookingSourceFilter, setBookingSourceFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [reservationsPerPage, setReservationsPerPage] = useState(25);
  
  const canManageReservations = user?.permissions?.reservations;

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setReservations([]);
      setPropertySettings(null);
      setRoomTypes([]);
      setIsLoading(false); 
      return;
    }

    setIsLoading(true);
    // Fetch Property Settings for currency
    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists()) setPropertySettings(docSnap.data() as Property);
    });
    
    const rtQuery = query(collection(db, "roomTypes"), where("propertyId", "==", propertyId));
    const unsubRoomTypes = onSnapshot(rtQuery, (snapshot) => {
        setRoomTypes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
    });

    const reservationsColRef = collection(db, "reservations");
    const q = query(
      reservationsColRef, 
      where("propertyId", "==", propertyId), 
      where("status", "in", ["Canceled", "No-Show"]),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReservations = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startDate: (data.startDate as Timestamp).toDate(),
          endDate: (data.endDate as Timestamp).toDate(),
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
          actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
          actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
        } as Reservation;
      });
      setReservations(fetchedReservations);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching reservations:", error);
      toast({ title: "Error", description: "Could not fetch cancelled/no-show reservations.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      unsubProp();
      unsubRoomTypes();
    };
  }, [propertyId]);

  // Watch total reservations for the same date range to compute cancellation rate
  useEffect(() => {
    if (!propertyId) {
      setTotalReservationsInRange(null);
      return;
    }

    // Determine range to use: use dateRangeFilter if present, else today
    const from = dateRangeFilter?.from ? startOfDay(dateRangeFilter.from) : startOfDay(new Date());
    const to = dateRangeFilter?.to ? startOfDay(dateRangeFilter.to) : startOfDay(new Date());

    const reservationsColRef = collection(db, 'reservations');
    const q = query(
      reservationsColRef,
      where('propertyId', '==', propertyId),
      where('startDate', '>=', from),
      where('startDate', '<=', to)
    );

    const unsub = onSnapshot(q, (snap) => {
      setTotalReservationsInRange(snap.size);
    }, (err) => {
      console.error('Error counting reservations in range', err);
      setTotalReservationsInRange(null);
    });

    return () => unsub();
  }, [propertyId, dateRangeFilter]);

  // Fetch payments in the same date range to compute non-refundable loss and refunded amounts
  // Use `cancellationDateRange` when provided so refunded amounts align with cancellation filter
  useEffect(() => {
    if (!propertyId) {
      setPaymentsForRange([]);
      return;
    }

    const range = cancellationDateRange ?? dateRangeFilter;
    const from = range?.from ? startOfDay(range.from) : startOfDay(new Date());
    const to = range?.to ? startOfDay(range.to) : startOfDay(new Date());

    const paymentsColRef = collection(db, `properties/${propertyId}/payments`);
    const q = query(
      paymentsColRef,
      where('createdAt', '>=', from),
      where('createdAt', '<=', to),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPaymentsForRange(fetched as any[]);
    }, (err) => {
      console.error('Error fetching payments for range', err);
      setPaymentsForRange([]);
    });

    return () => unsub();
  }, [propertyId, dateRangeFilter, cancellationDateRange]);

  // Helper to safely handle Timestamp | Date
  function toDateSafe(d?: any) {
    if (!d) return undefined;
    if (d instanceof Date) return d;
    if (d.toDate && typeof d.toDate === 'function') return d.toDate();
    return new Date(d);
  }

  const filteredReservations = useMemo(() => {
    let filtered = reservations;

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(res => 
        res.guestName?.toLowerCase().includes(lowercasedTerm) || 
        res.id.toLowerCase().includes(lowercasedTerm)
      );
    }
    
    if (roomTypeFilter !== 'all') {
      filtered = filtered.filter(res => {
        // reservation may have rooms array; compare roomTypeId in rooms
        if (Array.isArray(res.rooms) && res.rooms.length > 0) {
          return res.rooms.some(r => r.roomTypeId === roomTypeFilter);
        }
        return false;
      });
    }

    if (dateRangeFilter?.from && dateRangeFilter?.to) {
      const from = startOfDay(dateRangeFilter.from);
      const to = startOfDay(dateRangeFilter.to);
      filtered = filtered.filter(res => {
        const resStart = startOfDay(toDateSafe(res.startDate));
        const resEnd = startOfDay(toDateSafe(res.endDate));
        return resStart <= to && resEnd >= from;
      });
    }

    if (cancellationDateRange?.from && cancellationDateRange?.to) {
      const from = startOfDay(cancellationDateRange.from);
      const to = startOfDay(cancellationDateRange.to);
      filtered = filtered.filter(res => {
        const cancelled = toDateSafe(res.updatedAt) || toDateSafe(res.createdAt) || toDateSafe((res as any).cancellationDate);
        if (!cancelled) return false;
        const d = startOfDay(cancelled);
        return d >= from && d <= to;
      });
    }

    if (cancellationReason) {
      const term = cancellationReason.toLowerCase();
      filtered = filtered.filter(res => {
        const reason = (res as any).cancellationReason || (res as any).cancellation?.reason || '';
        return typeof reason === 'string' && reason.toLowerCase().includes(term);
      });
    }

    if (bookingSourceFilter && bookingSourceFilter !== 'all') {
      filtered = filtered.filter(res => (res.source || '').toString() === bookingSourceFilter);
    }

    if (paymentStatusFilter && paymentStatusFilter !== 'all') {
      filtered = filtered.filter(res => (res.paymentStatus || '').toString() === paymentStatusFilter);
    }

    return filtered;
  }, [reservations, searchTerm, roomTypeFilter, dateRangeFilter]);


  const kpis = useMemo(() => {
    // KPIs are calculated based on the cancellation date (updatedAt or explicit cancellationDate)
    const kpiFrom = cancellationDateRange?.from ? startOfDay(cancellationDateRange.from) : startOfDay(new Date());
    const kpiTo = cancellationDateRange?.to ? startOfDay(cancellationDateRange.to) : startOfDay(new Date());

    const cancelledInRange = filteredReservations.filter(r => {
      const cancelled = toDateSafe(r.updatedAt) || toDateSafe((r as any).cancellationDate);
      if (!cancelled) return false;
      const d = startOfDay(cancelled);
      return d.getTime() >= kpiFrom.getTime() && d.getTime() <= kpiTo.getTime();
    });

    const totalCancellations = cancelledInRange.length;

    const canceledRevenue = cancelledInRange.reduce((sum, r) => {
      // Try multiple field names for total price
      const val = r.totalPrice ?? r.netAmount ?? r.roomsTotal ?? 0;
      const amount = typeof val === 'number' ? val : Number(val || 0);
      return sum + amount;
    }, 0);

    const today = startOfDay(new Date());
    const cancellationsToday = cancelledInRange.filter(r => {
      const cancelled = toDateSafe(r.updatedAt) || toDateSafe((r as any).cancellationDate);
      if (!cancelled) return false;
      return startOfDay(cancelled).getTime() === today.getTime();
    }).length;

    // Cancellation rate: canceled / total in same range
    const cancellationRate = totalReservationsInRange && totalReservationsInRange > 0
      ? (totalCancellations / totalReservationsInRange) * 100
      : 0;

    // Average time from booking to cancellation (in days) computed on cancelledInRange
    const avgTimeToCancel = (() => {
      const diffs: number[] = [];
      cancelledInRange.forEach(r => {
        const created = toDateSafe(r.createdAt);
        const cancelled = toDateSafe(r.updatedAt) || toDateSafe(r.createdAt);
        if (created && cancelled) {
          const days = (cancelled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          diffs.push(days);
        }
      });
      if (!diffs.length) return 0;
      return diffs.reduce((a,b) => a+b, 0) / diffs.length;
    })();

    // Late cancellations: cancellations within 24 hours of startDate
    const lateCancellations = cancelledInRange.filter(r => {
      const cancelled = toDateSafe(r.updatedAt) || toDateSafe(r.createdAt);
      const start = toDateSafe(r.startDate);
      if (!cancelled || !start) return false;
      const diffHours = (start.getTime() - cancelled.getTime()) / (1000 * 60 * 60);
      return diffHours <= 24;
    }).length;

    // Non-refundable loss: sum net payments for these reservations (payments - refunds)
    const resIds = new Set(filteredReservations.map(r => r.id));
    const nonRefundableLoss = paymentsForRange.reduce((sum, p) => {
      if (!p || !p.reservationId) return sum;
      if (!resIds.has(p.reservationId)) return sum;
      const amt = typeof p.amountPaid === 'number' ? p.amountPaid : Number(p.amountPaid || 0);
      return sum + amt;
    }, 0) || 0;

    // Refunded amount: prefer reservation-level `refundedAmount` when present (partial or full),
    // otherwise fall back to reservation-level status, then payments.
    const refundedAmountFromReservations = cancelledInRange.reduce((sum, r) => {
      const ra = (r as any).refundedAmount;
      if (typeof ra === 'number' && ra > 0) return sum + ra;
      const status = (r.paymentStatus || '').toString();
      if (status === 'Refunded') {
        const val = r.netAmount ?? r.totalPrice ?? 0;
        return sum + (typeof val === 'number' ? val : Number(val || 0));
      }
      return sum;
    }, 0) || 0;

    // Fallback: sum payments marked as 'Refunded' related to cancelled reservations in range
    const cancelledIds = new Set(cancelledInRange.map(r => r.id));
    const refundedAmountFromPayments = paymentsForRange.reduce((sum, p) => {
      if (!p || !p.reservationId) return sum;
      if (!cancelledIds.has(p.reservationId)) return sum;
      const st = (p.status || '').toString();
      if (st !== 'Refunded' && st !== 'Partial-Refund') return sum;
      const amt = typeof p.amountPaid === 'number' ? p.amountPaid : Number(p.amountPaid || 0);
      return sum + amt;
    }, 0) || 0;

    const refundedAmount = refundedAmountFromReservations || refundedAmountFromPayments;

    return { totalCancellations, canceledRevenue, cancellationsToday, cancellationRate, avgTimeToCancel, lateCancellations, nonRefundableLoss, refundedAmount };
  }, [filteredReservations, paymentsForRange]);

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: propertySettings?.currency || 'USD' }).format(value);
    } catch (e) {
      return `${value.toFixed(2)}`;
    }
  };

  const paginatedReservations = useMemo(() => {
    const startIndex = (currentPage - 1) * reservationsPerPage;
    const endIndex = startIndex + reservationsPerPage;
    return filteredReservations.slice(startIndex, endIndex);
  }, [filteredReservations, currentPage, reservationsPerPage]);

  const totalPages = Math.ceil(filteredReservations.length / reservationsPerPage);
  
  const handleEditReservation = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsFormModalOpen(true);
  };
  
  const handleViewReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsDetailModalOpen(true);
  };

  const handleDeleteReservation = async (reservationId: string) => {
    if (!propertyId) return;
    if (!confirm("Are you sure you want to permanently delete this reservation? This action cannot be undone.")) return;
    
    setIsLoading(true); 
    try {
      await deleteDoc(doc(db, "reservations", reservationId));
      toast({title: "Success", description: "Reservation deleted successfully."});
    } catch (error) {
      toast({title: "Error", description: "Could not delete reservation.", variant: "destructive"});
    } finally {
      setIsLoading(false); 
    }
  };

  const handleRefundReservation = async (reservationId: string) => {
    if (!canManageReservations) {
      toast({ title: 'Permission Denied', description: 'You cannot process refunds.', variant: 'destructive' });
      return;
    }
    if (!confirm('Mark this reservation as refunded?')) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'reservations', reservationId), { paymentStatus: 'Refunded', updatedAt: new Date() });
      toast({ title: 'Success', description: 'Reservation marked as refunded.' });
    } catch (err) {
      console.error('Refund mark error', err);
      toast({ title: 'Error', description: 'Could not mark reservation as refunded.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreReservation = async (reservation: Reservation) => {
    if (!canManageReservations) {
      toast({ title: 'Permission Denied', description: 'You cannot restore reservations.', variant: 'destructive' });
      return;
    }
    if (!confirm('Restore this reservation to Confirmed status?')) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'reservations', reservation.id), { status: 'Confirmed', updatedAt: new Date() });
      toast({ title: 'Success', description: 'Reservation restored.' });
    } catch (err) {
      console.error('Restore error', err);
      toast({ title: 'Error', description: 'Could not restore reservation.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Refund dialog state
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundReservation, setRefundReservation] = useState<Reservation | null>(null);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');

  const openRefundDialog = (reservation: Reservation) => {
    setRefundReservation(reservation);
    setRefundType('full');
    setRefundAmountInput('');
    setIsRefundDialogOpen(true);
  };

  const handleConfirmRefund = async () => {
    if (!refundReservation) return;
    if (!canManageReservations) {
      toast({ title: 'Permission Denied', description: 'You cannot process refunds.', variant: 'destructive' });
      return;
    }

    let amount = 0;
    if (refundType === 'full') {
      amount = refundReservation.netAmount ?? refundReservation.totalPrice ?? refundReservation.roomsTotal ?? 0;
    } else {
      amount = Number(refundAmountInput || 0);
      if (!amount || amount <= 0) {
        toast({ title: 'Invalid amount', description: 'Please enter a valid refund amount.', variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    try {
      const statusToSet = refundType === 'partial' ? 'Partial-Refund' : 'Refunded';
      await updateDoc(doc(db, 'reservations', refundReservation.id), { paymentStatus: statusToSet, refundedAmount: amount, updatedAt: new Date() });
      toast({ title: 'Success', description: 'Refund recorded.' });
    } catch (err) {
      console.error('Refund save error', err);
      toast({ title: 'Error', description: 'Could not save refund to reservation.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsRefundDialogOpen(false);
      setRefundReservation(null);
    }
  };

  const handleBulkDelete = async (reservationIds: string[]) => {
    if (!canManageReservations) {
      toast({ title: "Permission Denied", description: "You cannot delete reservations.", variant: "destructive" });
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete ${reservationIds.length} reservation(s)? This action cannot be undone.`)) return;

    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      reservationIds.forEach(id => {
        batch.delete(doc(db, "reservations", id));
      });
      await batch.commit();
      toast({ title: "Success", description: `${reservationIds.length} reservation(s) deleted.` });
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast({ title: "Error", description: "Could not delete all selected reservations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.reservations) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view this page. Please contact an administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col space-y-6 w-full max-w-full overflow-hidden p-4 md:p-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Canceled Reservations</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of cancellations and no-shows with tools to filter, analyze, and export cancelled bookings.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Total Cancellations</div>
          <div className="text-2xl font-semibold">{kpis.totalCancellations}</div>
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Canceled Revenue</div>
          <div className="text-2xl font-semibold">{formatCurrency(kpis.canceledRevenue)}</div>
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Cancellations Today</div>
          <div className="text-2xl font-semibold">{kpis.cancellationsToday}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Cancellation Rate</div>
          <div className="text-2xl font-semibold">{kpis.cancellationRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground mt-1">of reservations in selected range</div>
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Avg Time to Cancellation</div>
          <div className="text-2xl font-semibold">{kpis.avgTimeToCancel ? `${kpis.avgTimeToCancel.toFixed(1)} days` : `—`}</div>
          <div className="text-xs text-muted-foreground mt-1">Late cancellations: {kpis.lateCancellations}</div>
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Refunded</div>
          <div className="text-2xl font-semibold">{formatCurrency(kpis.refundedAmount || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Shows refunded amount within cancellation filter</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Non-Refundable Loss</div>
          <div className="text-2xl font-semibold">{formatCurrency(kpis.nonRefundableLoss || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Revenue not refunded</div>
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm">
          <div className="text-sm text-muted-foreground">Total Potential Loss</div>
          <div className="text-2xl font-semibold">{formatCurrency(kpis.canceledRevenue - kpis.refundedAmount)}</div>
          <div className="text-xs text-muted-foreground mt-1">Canceled revenue minus refunds</div>
        </div>
      </div>

      <div className="relative w-full left-1/2 translate-x-[-50%] mt-4">
        <div className="bg-white p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Cancellations (last 14 days)</div>
          <ChartContainer config={{ main: { color: 'hsl(var(--chart-1))' } }} className="h-36 w-full">
          <AreaChart
            data={(() => {
              // build last 14 days counts
              const days = 14;
              const map = new Map();
              for (let i = days - 1; i >= 0; i--) {
                const d = startOfDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
                map.set(d.toISOString().slice(0,10), { date: d.toISOString().slice(0,10), count: 0 });
              }
              filteredReservations.forEach(r => {
                const cancelled = toDateSafe(r.updatedAt) || toDateSafe(r.createdAt) || toDateSafe(r.endDate);
                if (!cancelled) return;
                const key = startOfDay(cancelled).toISOString().slice(0,10);
                if (map.has(key)) map.get(key).count += 1;
              });
              return Array.from(map.values());
            })()}
          >
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-main)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-main)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <CartesianGrid strokeDasharray="3 3" />
            <Area type="monotone" dataKey="count" stroke="var(--color-main)" fill="url(#grad)" />
            <ChartTooltip content={<ChartTooltipContent />} />
          </AreaChart>
          </ChartContainer>
        </div>
      </div>

        <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                  <Icons.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Search by name or ID..."
                      className="w-full bg-white pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="w-full md:w-auto">
                <ReservationFilters
                roomTypes={roomTypes}
                statusFilter={'Canceled'}
                onStatusFilterChange={() => {}}
                roomTypeFilter={roomTypeFilter}
                onRoomTypeFilterChange={(v) => setRoomTypeFilter(v)}
                bookedDateRange={undefined}
                onBookedDateRangeChange={() => {}}
                checkinDateRange={dateRangeFilter}
                onCheckinDateRangeChange={(r) => setDateRangeFilter(r)}
                checkoutDateRange={undefined}
                onCheckoutDateRangeChange={() => {}}
                cancellationDateRange={cancellationDateRange}
                onCancellationDateRangeChange={(r) => setCancellationDateRange(r)}
                cancellationReason={cancellationReason}
                onCancellationReasonChange={(s) => setCancellationReason(s)}
                bookingSource={bookingSourceFilter}
                onBookingSourceChange={(s) => setBookingSourceFilter(s)}
                paymentStatus={paymentStatusFilter}
                onPaymentStatusChange={(s) => setPaymentStatusFilter(s)}
                />
              </div>
              <ExportReservationsButton />
        </div>

        <ReservationList 
        reservations={paginatedReservations}
        isLoading={isLoading}
        onEditReservation={handleEditReservation}
        onViewReservation={handleViewReservation} 
        onDeleteReservation={handleDeleteReservation}
          onRefundReservation={handleRefundReservation}
          onRestoreReservation={handleRestoreReservation}
          onOpenRefundDialog={openRefundDialog}
          showRefundTotal={true}
        canManage={canManageReservations}
        propertyCurrency={propertySettings?.currency}
        currentPropertyId={propertyId}
        currentPage={currentPage}
        totalPages={totalPages}
        onNextPage={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
        onPrevPage={() => setCurrentPage(p => Math.max(p - 1, 1))}
        reservationsPerPage={reservationsPerPage}
        onReservationsPerPageChange={(value) => { setReservationsPerPage(Number(value)); setCurrentPage(1); }}
        totalFilteredCount={filteredReservations.length}
        bulkActions={['delete']}
        onBulkDelete={handleBulkDelete}
          hideCreateGuest={true}
      />

      {editingReservation && (
        <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { setIsFormModalOpen(isOpen); if(!isOpen) setEditingReservation(null); }}>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Edit Reservation</DialogTitle>
              <DialogDescription>Update guest and booking details.</DialogDescription>
            </DialogHeader>
            <ReservationForm 
              onClose={() => { setIsFormModalOpen(false); setEditingReservation(null); }} 
              initialData={editingReservation}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Refund Dialog */}
      {isRefundDialogOpen && refundReservation && (
        <Dialog open={isRefundDialogOpen} onOpenChange={(open) => { setIsRefundDialogOpen(open); if(!open) setRefundReservation(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Refund</DialogTitle>
              <DialogDescription>Choose full or partial refund amount for this reservation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="radio" name="refundType" checked={refundType === 'full'} onChange={() => setRefundType('full')} />
                  <span>Full refund</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" name="refundType" checked={refundType === 'partial'} onChange={() => setRefundType('partial')} />
                  <span>Partial refund</span>
                </label>
              </div>
              {refundType === 'partial' && (
                <div>
                  <label className="text-sm text-muted-foreground">Amount</label>
                  <Input type="number" value={refundAmountInput} onChange={(e) => setRefundAmountInput(e.target.value)} placeholder="0.00" />
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => { setIsRefundDialogOpen(false); setRefundReservation(null); }}>Cancel</Button>
                <Button onClick={handleConfirmRefund}>Confirm Refund</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedReservation && (
        <ReservationDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedReservation(null); }}
          reservation={selectedReservation}
          propertySettings={propertySettings}
        />
      )}
    </div>
  );
}
