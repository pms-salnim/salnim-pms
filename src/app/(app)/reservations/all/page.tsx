"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Users, TrendingUp, AlertCircle, BarChart3, Clock, Percent } from "lucide-react";
import ReservationFilters from "@/components/reservations/reservation-filters";
import ReservationList from "@/components/reservations/reservation-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, orderBy, deleteDoc, writeBatch, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { ReservationStatus, Reservation } from '@/types/reservation';
import type { FirestoreUser } from '@/types/firestoreUser';
import type { Property } from '@/types/property';
import type { RoomType } from '@/types/roomType';
import type { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, format, parseISO, isWithinInterval } from 'date-fns';
import type { Room } from '@/types/room';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import type { Payment, Invoice } from '@/app/(app)/payments/page';
import type { ManualPaymentData } from '@/components/payments/payment-form';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ledgerService } from '@/lib/ledgerService';

// Helper to convert Firestore Timestamp to JS Date
const convertTimestampToDate = (timestamp: Timestamp | null | undefined): Date | null => {
  return timestamp instanceof Timestamp ? timestamp.toDate() : null;
};

// Display status type used in filters
export type ReservationDisplayStatus = 'Pending' | 'Confirmed' | 'Checked-in' | 'Completed' | 'Canceled' | 'No-Show';

const ReservationForm = dynamic(() => import('@/components/reservations/reservation-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});
const ReservationDetailModal = dynamic(() => import('@/components/reservations/reservation-detail-modal'), {
  loading: () => <div className="flex h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const InvoiceViewModal = dynamic(() => import('@/components/payments/invoice-view-modal'), {
    loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});
const PaymentForm = dynamic(() => import('@/components/payments/payment-form'), {
    loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
    ssr: false,
});


export default function AllReservationsPage() {
  const { user, isLoadingAuth } = useAuth();
  const searchParams = useSearchParams();
  const { t } = useTranslation('pages/reservations/all/content');
  const { t: tForm } = useTranslation('pages/dashboard/reservation-form');

  // State hooks
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);

  // Filtering and sorting state
  const [statusFilter, setStatusFilter] = useState<'all' | ReservationDisplayStatus>('all');
  const [bookedDateRange, setBookedDateRange] = useState<DateRange | undefined>(undefined);
  const [checkinDateRange, setCheckinDateRange] = useState<DateRange | undefined>(undefined);
  const [checkoutDateRange, setCheckoutDateRange] = useState<DateRange | undefined>(undefined);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [bookingSourceFilter, setBookingSourceFilter] = useState<string>('all');
  const [guestsFilter, setGuestsFilter] = useState<string>('all');
  const [ratePlanFilter, setRatePlanFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reservationTab, setReservationTab] = useState<'all' | 'new' | 'arrivals' | 'departures' | 'in-house' | 'pending' | 'canceled'>('all');

  // Modal and dialog state
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [selectedReservationForPayment, setSelectedReservationForPayment] = useState<Reservation | null>(null);
  const [paymentInitialData, setPaymentInitialData] = useState<Partial<ManualPaymentData> | null>(null);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reservationsToDelete, setReservationsToDelete] = useState<string[]>([]);
  const [deleteRelatedDocs, setDeleteRelatedDocs] = useState(true);

  // Detail modal state
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Status change dialog state
  const [statusChangeInfo, setStatusChangeInfo] = useState<{ ids: string[]; status: ReservationStatus } | null>(null);
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);

  // Refund dialog state for cancellations
  const [refundDialogInfo, setRefundDialogInfo] = useState<{ reservationId: string; reservation: Reservation; shouldRefund: boolean; refundAmount: number } | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Sorting state
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Reintroduce missing variables
  const reservationIdToView = searchParams.get('view');
  const canManageReservations = user?.permissions?.reservations;

  // Memoized values
  const filteredReservations = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    return reservations.filter(res => {
      // Tab filtering
      if (reservationTab !== 'all') {
        if (reservationTab === 'new') {
          const createdAt = res.createdAt instanceof Date
            ? res.createdAt
            : (res.createdAt && typeof (res.createdAt as any).toDate === 'function')
              ? (res.createdAt as any).toDate()
              : res.createdAt ? new Date(res.createdAt as any) : null;
          if (!createdAt || !isWithinInterval(createdAt, { start: todayStart, end: todayEnd })) {
            return false;
          }
        } else if (reservationTab === 'arrivals') {
          const startDate = res.startDate instanceof Date
            ? res.startDate
            : (res.startDate && typeof (res.startDate as any).toDate === 'function')
              ? (res.startDate as any).toDate()
              : res.startDate ? new Date(res.startDate as any) : null;
          if (!startDate || !isWithinInterval(startDate, { start: todayStart, end: todayEnd })) {
            return false;
          }
        } else if (reservationTab === 'departures') {
          const endDate = res.endDate instanceof Date
            ? res.endDate
            : (res.endDate && typeof (res.endDate as any).toDate === 'function')
              ? (res.endDate as any).toDate()
              : res.endDate ? new Date(res.endDate as any) : null;
          if (!endDate || !isWithinInterval(endDate, { start: todayStart, end: todayEnd })) {
            return false;
          }
        } else if (reservationTab === 'in-house') {
          if (res.status !== 'Checked-in') return false;
        } else if (reservationTab === 'pending') {
          if (res.status !== 'Pending') return false;
        } else if (reservationTab === 'canceled') {
          if (res.status !== 'Canceled') return false;
        }
      }

      if (statusFilter !== 'all' && res.status !== statusFilter) return false;
      if (bookedDateRange?.from) {
        const createdAt = res.createdAt instanceof Date
          ? res.createdAt
          : (res.createdAt && typeof (res.createdAt as any).toDate === 'function')
            ? (res.createdAt as any).toDate()
            : res.createdAt ? new Date(res.createdAt as any) : null;
        if (!createdAt || !isWithinInterval(createdAt, { start: startOfDay(bookedDateRange.from), end: endOfDay(bookedDateRange.to || bookedDateRange.from) })) {
          return false;
        }
      }
      if (checkinDateRange?.from) {
        const startDate = res.startDate instanceof Date
          ? res.startDate
          : (res.startDate && typeof (res.startDate as any).toDate === 'function')
            ? (res.startDate as any).toDate()
            : res.startDate ? new Date(res.startDate as any) : null;
        if (!startDate || !isWithinInterval(startDate, { start: startOfDay(checkinDateRange.from), end: endOfDay(checkinDateRange.to || checkinDateRange.from) })) {
          return false;
        }
      }
      if (checkoutDateRange?.from) {
        const endDate = res.endDate instanceof Date
          ? res.endDate
          : (res.endDate && typeof (res.endDate as any).toDate === 'function')
            ? (res.endDate as any).toDate()
            : res.endDate ? new Date(res.endDate as any) : null;
        if (!endDate || !isWithinInterval(endDate, { start: startOfDay(checkoutDateRange.from), end: endOfDay(checkoutDateRange.to || checkoutDateRange.from) })) {
          return false;
        }
      }
      if (roomTypeFilter !== 'all' && !res.rooms.some(room => room.roomTypeId === roomTypeFilter)) {
        return false;
      }
      if (paymentStatusFilter !== 'all' && res.paymentStatus !== paymentStatusFilter) return false;
      if (bookingSourceFilter !== 'all' && res.source !== bookingSourceFilter) return false;
      if (guestsFilter !== 'all') {
        const guestCount = res.adults + (res.children || 0);
        if (guestsFilter === '1' && guestCount !== 1) return false;
        if (guestsFilter === '2' && guestCount !== 2) return false;
        if (guestsFilter === '3-4' && (guestCount < 3 || guestCount > 4)) return false;
        if (guestsFilter === '5+' && guestCount < 5) return false;
      }
      if (ratePlanFilter !== 'all' && res.ratePlanId !== ratePlanFilter) return false;
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        return (
          res.guestName?.toLowerCase().includes(searchTermLower) ||
          res.guestEmail?.toLowerCase().includes(searchTermLower) ||
          res.guestPhone?.toLowerCase().includes(searchTermLower) ||
          res.reservationNumber?.toLowerCase().includes(searchTermLower) ||
          res.id.toLowerCase().includes(searchTermLower)
        );
      }
      return true;
    });
  }, [reservations, reservationTab, statusFilter, bookedDateRange, checkinDateRange, checkoutDateRange, roomTypeFilter, paymentStatusFilter, bookingSourceFilter, guestsFilter, ratePlanFilter, searchTerm]);

  const kpis = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Effective range: use `checkinDateRange` if present, otherwise default to today
    const effectiveFrom = checkinDateRange?.from ? startOfDay(checkinDateRange.from) : todayStart;
    const effectiveTo = checkinDateRange?.to ? endOfDay(checkinDateRange.to!) : todayEnd;

    const toDateSafe = (val: any): Date | null => {
      if (!val) return null;
      if (val instanceof Date) return val;
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };

    const base = filteredReservations; // already applies non-date filters

    const inStartRange = (r: any) => {
      const sd = toDateSafe(r.startDate);
      return sd && sd >= effectiveFrom && sd <= effectiveTo;
    };

    const inEndRange = (r: any) => {
      const ed = toDateSafe(r.endDate);
      return ed && ed >= effectiveFrom && ed <= effectiveTo;
    };

    const overlapsRange = (r: any) => {
      const sd = toDateSafe(r.startDate);
      const ed = toDateSafe(r.endDate);
      if (!sd || !ed) return false;
      return sd <= effectiveTo && ed >= effectiveFrom;
    };

    const upcomingArrivals = base.filter(r => inStartRange(r) && r.status !== 'Canceled' && r.status !== 'No-Show').length;

    const departuresToday = base.filter(r => inEndRange(r)).length;

    const pendingReservations = base.filter(r => r.status === 'Pending' && inStartRange(r)).length;

    const canceledNoShows = base.filter(r => (r.status === 'Canceled' || r.status === 'No-Show') && inStartRange(r)).length;

    const revenueBooked = base
      .filter(r => (r.status !== 'Canceled' && r.status !== 'No-Show') && inStartRange(r))
      .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    const avgLengthOfStay = base.length > 0
      ? base.filter(inStartRange).reduce((sum, r) => {
          const sd = toDateSafe(r.startDate)!;
          const ed = toDateSafe(r.endDate)!;
          const days = Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / Math.max(1, base.filter(inStartRange).length)
      : 0;

    const totalRooms = allRooms.length;
    const occupiedRooms = base.filter(r => r.status === 'Checked-in' && overlapsRange(r)).length;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    return {
      totalReservations: reservations.length,
      upcomingArrivals,
      departuresToday,
      pendingReservations,
      canceledNoShows,
      revenueBooked,
      avgLengthOfStay,
      occupancyRate,
    };
  }, [reservations, allRooms, filteredReservations, checkinDateRange]);

  // Sorting + pagination
  const sortedReservations = useMemo(() => {
    const arr = [...filteredReservations];
    arr.sort((a, b) => {
      const aVal: any = (a as any)[sortBy];
      const bVal: any = (b as any)[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Dates
      if ((aVal instanceof Date) || (aVal && typeof aVal.toDate === 'function')) {
        const aDate = aVal instanceof Date ? aVal : (aVal.toDate?.() ?? new Date(aVal));
        const bDate = bVal instanceof Date ? bVal : (bVal.toDate?.() ?? new Date(bVal));
        return sortDirection === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }
      // Numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      // Fallback to string compare
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return arr;
  }, [filteredReservations, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedReservations.length / itemsPerPage));

  const paginatedReservations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedReservations.slice(start, start + itemsPerPage);
  }, [sortedReservations, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredReservations, itemsPerPage]);

  // Effects
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    } else {
      setPropertyId(null);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) return;
    setIsLoading(true);
    setIsLoadingInvoices(true);
    let listenerCount = 6; // reservations, properties, roomTypes, rooms, payments, invoices
    const doneLoading = () => {
        listenerCount--;
        if (listenerCount === 0) setIsLoading(false);
    }

    const unsubProp = onSnapshot(doc(db, "properties", propertyId), (docSnap) => {
      setPropertySettings(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Property : null);
      doneLoading();
    }, (error) => { console.error("Error fetching property settings:", error); doneLoading(); });
    
    const unsubRoomTypes = onSnapshot(query(collection(db, "roomTypes"), where("propertyId", "==", propertyId)), (snapshot) => {
        setRoomTypes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
        doneLoading();
    });

    const unsubRooms = onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", propertyId)), (snapshot) => {
        setAllRooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
        doneLoading();
    });

    const unsubReservations = onSnapshot(query(collection(db, "reservations"), where("propertyId", "==", propertyId), orderBy("createdAt", "desc")), (snapshot) => {
      setReservations(snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, ...data,
          startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate(),
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined, updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
          actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
          actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
        } as Reservation;
      }));
      doneLoading();
    }, (error) => {
      console.error("Error fetching reservations:", error);
      toast({ title: "Error", description: "Could not fetch reservations.", variant: "destructive" });
      doneLoading();
    });
    
    const unsubPayments = onSnapshot(query(collection(db, `properties/${propertyId}/payments`)), (snapshot) => {
        setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        doneLoading();
    });
    
    const unsubInvoices = onSnapshot(query(collection(db, "invoices"), where("propertyId", "==", propertyId)), (snapshot) => {
      setAllInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      setIsLoadingInvoices(false);
      doneLoading();
    }, (err) => {
      console.error("Error fetching invoices:", err);
      setIsLoadingInvoices(false);
      doneLoading();
    });

    return () => { unsubProp(); unsubRoomTypes(); unsubRooms(); unsubReservations(); unsubPayments(); unsubInvoices(); };
  }, [propertyId]);
  
  useEffect(() => {
    if (reservationIdToView && !isLoadingInvoices) {
      const fetchAndShowInvoice = async () => {
          const invoicesQuery = query(collection(db, "invoices"), where("reservationId", "==", reservationIdToView), limit(1));
          const querySnapshot = await getDocs(invoicesQuery);
          if (!querySnapshot.empty) {
              const invoiceDoc = querySnapshot.docs[0];
              setSelectedInvoice({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice);
              setIsViewInvoiceModalOpen(true);
          } else {
              toast({ title: t('toasts.not_found_title'), description: t('toasts.not_found_description'), variant: "destructive" });
          }
      };
      fetchAndShowInvoice();
    }
  }, [reservationIdToView, isLoadingInvoices, t]);

  const handleOpenReservationForm = (reservation: Reservation | null = null) => {
    if (!canManageReservations) return;
    setEditingReservation(reservation);
    setIsFormModalOpen(true);
  };

  const handleViewReservationDetails = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsDetailModalOpen(true);
  };

  const handleAddPayment = async (reservation: Reservation) => {
    // Prepare pre-filled payment form data
    let remainingAmount = reservation.totalPrice || 0;
    
    // Fetch existing payments for this reservation to calculate remaining amount
    if (propertyId) {
      try {
        const paymentsSnap = await getDocs(
          query(
            collection(db, `properties/${propertyId}/payments`),
            where('reservationId', '==', reservation.id)
          )
        );
        
        let totalPaid = 0;
        paymentsSnap.docs.forEach(doc => {
          totalPaid += doc.data().amountPaid || 0;
        });
        
        remainingAmount = Math.max(0, (reservation.totalPrice || 0) - totalPaid);
      } catch (error) {
        console.error("Error fetching payments:", error);
        remainingAmount = reservation.totalPrice || 0;
      }
    }
    
    const initialData: Partial<ManualPaymentData> = {
      amountReceived: remainingAmount,
      guestName: reservation.guestName,
      reservationNumber: reservation.reservationNumber,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
    };
    setPaymentInitialData(initialData);
    setSelectedReservationForPayment(reservation);
    setIsAddPaymentModalOpen(true);
  };

  const handleSavePayment = async (paymentData: ManualPaymentData) => {
    if (!propertyId || !selectedReservationForPayment) {
      toast({ title: "Error", description: "Missing required data", variant: "destructive" });
      return;
    }

    setIsPaymentSaving(true);
    try {
      const functions = getFunctions(app, 'europe-west1');
      const createPayment = httpsCallable(functions, 'createPayment');

      const payload = {
        reservationId: selectedReservationForPayment.id,
        amountReceived: paymentData.amountReceived,
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate,
        notes: paymentData.notes || null,
        guestName: selectedReservationForPayment.guestName,
        invoiceId: selectedReservationForPayment.id,
        reservationNumber: selectedReservationForPayment.reservationNumber,
        propertyId,
      };

      console.log("Calling createPayment with payload:", payload);
      const result = await createPayment(payload);

      console.log("createPayment result:", result);
      if ((result.data as any).success) {
        // Also create ledger entry for the payment
        const folioId = 'main-guest-folio';
        const ledgerResult = await ledgerService.createPayment(
          propertyId,
          selectedReservationForPayment.id,
          folioId,
          paymentData.amountReceived,
          paymentData.paymentMethod,
          paymentData.notes || `Payment via ${paymentData.paymentMethod}`
        );

        if (!ledgerResult.success) {
          console.warn("Ledger entry creation warning:", ledgerResult.error);
          // Don't fail the payment if ledger entry fails, just warn
          toast({
            title: "Warning",
            description: "Payment recorded but ledger entry failed. Please refresh.",
            variant: "default"
          });
        }

        toast({ title: "Success", description: "Payment recorded successfully" });
        setIsAddPaymentModalOpen(false);
        setSelectedReservationForPayment(null);
      } else {
        throw new Error((result.data as any).error || "Failed to save payment");
      }
    } catch (error: any) {
      console.error("Error saving payment:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      toast({ title: "Error", description: error.message || "Could not save payment", variant: "destructive" });
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const handleViewReservationInvoice = async (reservation: Reservation) => {
    if (!propertyId) {
      toast({ title: "Error", description: "Property not found", variant: "destructive" });
      return;
    }

    try {
      // Find the invoice associated with this reservation
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('reservationId', '==', reservation.id),
        where('propertyId', '==', propertyId),
        limit(1)
      );
      
      const invoiceSnapshot = await getDocs(invoicesQuery);
      
      if (invoiceSnapshot.empty) {
        toast({ title: "Info", description: "No invoice found for this reservation", variant: "default" });
        return;
      }

      const invoiceDoc = invoiceSnapshot.docs[0];
      const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;
      
      setSelectedInvoice(invoice);
      setIsViewInvoiceModalOpen(true);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      toast({ title: "Error", description: "Could not fetch invoice", variant: "destructive" });
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!canManageReservations) return;
    if (!confirm("Are you sure you want to cancel this reservation?")) return;
    
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "reservations", reservationId), {
        status: 'Canceled',
        updatedAt: serverTimestamp()
      });
      toast({ title: "Success", description: "Reservation cancelled successfully" });
    } catch (error) {
      console.error("Error canceling reservation:", error);
      toast({ title: "Error", description: "Could not cancel reservation", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveInvoice = async (invoiceData: Omit<Invoice, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>) => {
    if (!propertyId || !canManageReservations) {
      toast({ title: "Error", description: "Permission denied or property not found.", variant: "destructive" });
      return;
    }
    const dataToSave = { ...invoiceData, propertyId };
    try {
      if (editingReservation) {
        const docRef = doc(db, "invoices", editingReservation.id);
        await updateDoc(docRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.success'), description: t('toasts.update_success') });
      } else {
        await addDoc(collection(db, "invoices"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: t('toasts.success'), description: t('toasts.create_success') });
      }
      setIsFormModalOpen(false);
      setEditingReservation(null);
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({ title: "Error", description: "Could not save invoice.", variant: "destructive" });
    }
  };

  const handleDeleteReservation = (reservationId: string) => {
    if (!canManageReservations) return;
    setReservationsToDelete([reservationId]);
    setIsDeleteDialogOpen(true);
  };
  
  const handleBulkDelete = (reservationIds: string[]) => {
    if (!canManageReservations) return;
    setReservationsToDelete(reservationIds);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (reservationsToDelete.length === 0 || !canManageReservations || !propertyId) return;
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      
      for (const reservationId of reservationsToDelete) {
        // Delete the reservation
        batch.delete(doc(db, "reservations", reservationId));
        
        if (deleteRelatedDocs) {
          // Delete the invoice
          batch.delete(doc(db, "invoices", reservationId));
          
          // Delete payments associated with this reservation from the subcollection
          const paymentsRef = collection(db, `properties/${propertyId}/payments`);
          const q = query(paymentsRef, where("reservationId", "==", reservationId));
          const paymentDocs = await getDocs(q);
          paymentDocs.forEach(paymentDoc => {
            batch.delete(paymentDoc.ref);
          });
        }
      }
      
      await batch.commit();
      toast({ title: t('toasts.success'), description: t('toasts.delete_success', { count: reservationsToDelete.length }) });
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast({ title: "Error", description: "Could not delete all selected reservations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
      setReservationsToDelete([]);
    }
  };

  const handleBulkStatusChange = (reservationIds: string[], status: ReservationStatus) => {
    if (!canManageReservations) return;
    
    // If canceling, check if we need to show refund dialog
    if (status === 'Canceled') {
      const firstReservationId = reservationIds[0];
      const reservation = reservations.find(r => r.id === firstReservationId);
      
      if (reservation && (reservation.paymentStatus === 'Paid' || reservation.paymentStatus === 'Partial')) {
        // Show refund dialog for paid/partial reservations
        setRefundDialogInfo({
          reservationId: firstReservationId,
          reservation,
          shouldRefund: true,
          refundAmount: reservation.totalPrice || 0
        });
        setIsRefundDialogOpen(true);
        return;
      }
    }
    
    setStatusChangeInfo({ ids: reservationIds, status });
    setIsStatusChangeDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!statusChangeInfo || !canManageReservations) return;
    
    // Prevent changing FROM Completed status (completely locked)
    const completedReservations = statusChangeInfo.ids
      .map(id => reservations.find(r => r.id === id))
      .filter(res => res && res.status === 'Completed');
    
    if (completedReservations.length > 0) {
      toast({ 
        title: "Cannot Change Status", 
        description: "Completed reservations cannot be changed.", 
        variant: "destructive" 
      });
      setIsStatusChangeDialogOpen(false);
      setStatusChangeInfo(null);
      return;
    }
    
    // Prevent changing FROM Checked-in status to other statuses (except to Canceled)
    if (statusChangeInfo.status !== 'Canceled') {
      const checkedInReservations = statusChangeInfo.ids
        .map(id => reservations.find(r => r.id === id))
        .filter(res => res && res.status === 'Checked-in');
      
      if (checkedInReservations.length > 0) {
        toast({ 
          title: "Cannot Change Status", 
          description: "Checked-in reservations can only be canceled.", 
          variant: "destructive" 
        });
        setIsStatusChangeDialogOpen(false);
        setStatusChangeInfo(null);
        return;
      }
    }
    
    // Validate check-in requirement
    if (statusChangeInfo.status === 'Checked-in') {
      const today = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      
      // Check for canceled reservations
      const canceledReservations = statusChangeInfo.ids
        .map(id => reservations.find(r => r.id === id))
        .filter(res => res && res.status === 'Canceled');
      
      if (canceledReservations.length > 0) {
        toast({ 
          title: "Cannot Check In", 
          description: `${canceledReservations.length} reservation(s) are canceled and cannot be checked in.`, 
          variant: "destructive" 
        });
        setIsStatusChangeDialogOpen(false);
        setStatusChangeInfo(null);
        return;
      }
      
      const invalidReservations = statusChangeInfo.ids
        .map(id => reservations.find(r => r.id === id))
        .filter(res => {
          if (!res) return false;
          const startDate = res.startDate instanceof Date
            ? res.startDate
            : (res.startDate && typeof (res.startDate as any).toDate === 'function')
              ? (res.startDate as any).toDate()
              : res.startDate ? new Date(res.startDate as any) : null;
          return !startDate || !isWithinInterval(startDate, { start: today, end: todayEnd });
        });
      
      if (invalidReservations.length > 0) {
        toast({ 
          title: "Cannot Check In", 
          description: `${invalidReservations.length} reservation(s) cannot be checked in. Check-in date must be today.`, 
          variant: "destructive" 
        });
        setIsStatusChangeDialogOpen(false);
        setStatusChangeInfo(null);
        return;
      }
    }

    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      statusChangeInfo.ids.forEach(id => {
        batch.update(doc(db, "reservations", id), { status: statusChangeInfo.status, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      toast({ title: t('toasts.success'), description: t('toasts.status_change_success', { count: statusChangeInfo.ids.length, status: statusChangeInfo.status }) });
    } catch (err) {
      console.error("Bulk status change error:", err);
      toast({ title: "Error", description: "Could not update all selected reservations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsStatusChangeDialogOpen(false);
      setStatusChangeInfo(null);
    }
  };

  const handleRefundDialogConfirm = async () => {
    if (!refundDialogInfo || !propertyId) return;
    
    setIsLoading(true);
    try {
      // If refund is needed, find the payment and call createRefund
      if (refundDialogInfo.shouldRefund && refundDialogInfo.refundAmount > 0) {
        // Find the payment associated with this reservation
        const paymentsRef = collection(db, `properties/${propertyId}/payments`);
        const paymentQuery = query(paymentsRef, where("reservationId", "==", refundDialogInfo.reservationId), limit(1));
        const paymentSnapshot = await getDocs(paymentQuery);
        
        if (!paymentSnapshot.empty) {
          const paymentId = paymentSnapshot.docs[0].id;
          
          // Call the createRefund Cloud Function
          const functions = getFunctions(app, 'us-central1');
          const createRefund = httpsCallable(functions, 'createRefund');
          
          await createRefund({
            originalPaymentId: paymentId,
            propertyId,
            refundAmount: refundDialogInfo.refundAmount,
            reason: 'Reservation canceled by user'
          });
        }
      }
      
      // Update reservation status to canceled
      const batch = writeBatch(db);
      batch.update(doc(db, "reservations", refundDialogInfo.reservationId), {
        status: 'Canceled',
        updatedAt: serverTimestamp(),
        refundedAmount: refundDialogInfo.shouldRefund ? refundDialogInfo.refundAmount : 0,
      });
      await batch.commit();
      
      const currency = propertySettings?.currency || '$';
      toast({
        title: "Success",
        description: refundDialogInfo.shouldRefund
          ? `Reservation canceled. Refund of ${currency}${refundDialogInfo.refundAmount.toFixed(2)} approved.`
          : "Reservation canceled. No refund."
      });
    } catch (err: any) {
      console.error("Error processing cancellation:", err);
      toast({ title: "Error", description: err.message || "Could not cancel reservation", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsRefundDialogOpen(false);
      setRefundDialogInfo(null);
    }
  };


  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewInvoiceModalOpen(true);
  };
  
  const handleSortChange = (value: string) => {
    const [newSortBy, newSortDir] = value.split('-');
    setSortBy(newSortBy);
    setSortDirection(newSortDir as 'asc' | 'desc');
    setCurrentPage(1); 
  };


  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!canManageReservations) {
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
    <div className="flex flex-col space-y-6 w-full max-w-full overflow-hidden p-4 md:p-0">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Reservations</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.totalReservations}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar size={18} className="text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Upcoming Arrivals</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.upcomingArrivals}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-cyan-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Departures Today</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.departuresToday}</h3>
            </div>
            <div className="p-2 rounded-lg bg-cyan-50">
              <Users size={18} className="text-cyan-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.pendingReservations}</h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock size={18} className="text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-rose-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Canceled/No-Shows</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.canceledNoShows}</h3>
            </div>
            <div className="p-2 rounded-lg bg-rose-50">
              <AlertCircle size={18} className="text-rose-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revenue Booked</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{propertySettings?.currency || '$'}{kpis.revenueBooked.toFixed(2)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-green-50">
              <DollarSign size={18} className="text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Length of Stay</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.avgLengthOfStay.toFixed(1)} days</h3>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <BarChart3 size={18} className="text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Occupancy Rate</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.occupancyRate.toFixed(1)}%</h3>
            </div>
            <div className="p-2 rounded-lg bg-orange-50">
              <Percent size={18} className="text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
          <div className="relative flex-1 w-full">
              <Icons.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder={t('search_placeholder')} className="w-full pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
              <ReservationFilters 
                  roomTypes={roomTypes}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  roomTypeFilter={roomTypeFilter}
                  onRoomTypeFilterChange={setRoomTypeFilter}
                  bookedDateRange={bookedDateRange}
                  onBookedDateRangeChange={setBookedDateRange}
                  checkinDateRange={checkinDateRange}
                  onCheckinDateRangeChange={setCheckinDateRange}
                  checkoutDateRange={checkoutDateRange}
                  onCheckoutDateRangeChange={setCheckoutDateRange}
                  paymentStatusFilter={paymentStatusFilter}
                  onPaymentStatusFilterChange={setPaymentStatusFilter}
                  bookingSourceFilter={bookingSourceFilter}
                  onBookingSourceFilterChange={setBookingSourceFilter}
                  guestsFilter={guestsFilter}
                  onGuestsFilterChange={setGuestsFilter}
                  ratePlanFilter={ratePlanFilter}
                  onRatePlanFilterChange={setRatePlanFilter}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline"><Icons.Download className="mr-2 h-4 w-4" />{t('export_button')}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={()=>{}}>{t('export_pdf')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>{}}>{t('export_excel')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={()=>{}}>{t('export_csv')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { setIsFormModalOpen(isOpen); if (!isOpen) setEditingReservation(null); }}>
                  <DialogTrigger asChild>
                      <Button onClick={() => handleOpenReservationForm()} disabled={!propertyId || isLoading || !canManageReservations}>
                      <Icons.PlusCircle className="mr-2 h-4 w-4" /> {t('add_reservation_button')}
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-5xl p-0 h-[90vh] flex flex-col">
                    <DialogHeader className="px-6 pt-6">
                      <DialogTitle>{editingReservation ? tForm('edit_title') : tForm('create_title')}</DialogTitle>
                      <DialogDescription>{editingReservation ? tForm('edit_description') : tForm('create_description')}</DialogDescription>
                    </DialogHeader>
                    <ReservationForm 
                      onClose={() => { setIsFormModalOpen(false); setEditingReservation(null); }} 
                      initialData={editingReservation}
                    />
                  </DialogContent>
              </Dialog>
          </div>
        </div>
      </div>

      {/* Reservation Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('all')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'all' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('new')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'new' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          Today's New Reservations
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('arrivals')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'arrivals' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          Today's Arrivals
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('departures')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'departures' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          Today's Departures
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('in-house')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'in-house' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          In House
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('pending')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'pending' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          Pending
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReservationTab('canceled')}
          className={`rounded-none px-4 py-2 ${reservationTab === 'canceled' ? 'border-b-2 border-b-primary text-primary' : 'text-slate-600 border-b-2 border-b-transparent'}`}
        >
          Canceled
        </Button>
      </div>

      <div className="space-y-4">
        <ReservationList 
          reservations={paginatedReservations}
          payments={payments}
          isLoading={isLoading}
          onEditReservation={handleOpenReservationForm} 
          onViewReservation={handleViewReservationDetails} 
          onDeleteReservation={handleDeleteReservation}
          onAddPayment={handleAddPayment}
          onViewInvoice={handleViewReservationInvoice}
          onCancelReservation={handleCancelReservation}
          onCheckIn={() => {}} 
          onCheckOut={() => {}}
          canManage={canManageReservations} 
          propertyCurrency={propertySettings?.currency} 
          currentPropertyId={propertyId}
          currentPage={currentPage} 
          totalPages={totalPages} 
          onNextPage={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
          onPrevPage={() => setCurrentPage(p => Math.max(1, p - 1))}
          reservationsPerPage={itemsPerPage} 
          onReservationsPerPageChange={(value: string) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
          totalFilteredCount={filteredReservations.length} 
          bulkActions={['delete', 'changeStatus']}
          onBulkDelete={handleBulkDelete} 
          onBulkStatusChange={handleBulkStatusChange} 
          propertySettings={propertySettings}
        />
      </div>
      
      {selectedReservation && (
        <ReservationDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedReservation(null);
          }}
          initialData={selectedReservation}
          propertySettings={propertySettings}
          onEdit={handleOpenReservationForm}
          canManage={canManageReservations}
          onCheckIn={() => {}}
          onCheckOut={() => {}}
        />
      )}
      
      {isViewInvoiceModalOpen && selectedInvoice && (
        <InvoiceViewModal
          isOpen={isViewInvoiceModalOpen}
          onClose={() => setIsViewInvoiceModalOpen(false)}
          invoice={selectedInvoice}
          propertySettings={propertySettings}
          onEdit={handleSaveInvoice as any}
          canManage={canManageReservations}
        />
      )}

      <Dialog open={isAddPaymentModalOpen} onOpenChange={setIsAddPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedReservationForPayment?.guestName}
            </DialogDescription>
          </DialogHeader>
          {propertyId && selectedReservationForPayment && (
            <PaymentForm
              propertyId={propertyId}
              onClose={() => {
                setIsAddPaymentModalOpen(false);
                setSelectedReservationForPayment(null);
                setPaymentInitialData(null);
              }}
              onSave={handleSavePayment}
              isSaving={isPaymentSaving}
              initialData={paymentInitialData || undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modals.delete_confirmation.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('modals.delete_confirmation.description', { count: reservationsToDelete.length })}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 my-4">
            <Checkbox id="delete-related" checked={deleteRelatedDocs} onCheckedChange={(checked) => setDeleteRelatedDocs(Boolean(checked))} />
            <Label htmlFor="delete-related" className="text-sm font-normal text-muted-foreground">
              {t('modals.delete_confirmation.delete_related_docs')}
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReservationsToDelete([])}>{t('modals.delete_confirmation.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>{isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}{t('modals.delete_confirmation.continue_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isStatusChangeDialogOpen} onOpenChange={setIsStatusChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modals.status_change_confirmation.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('modals.status_change_confirmation.description', { count: statusChangeInfo?.ids.length, status: statusChangeInfo?.status })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStatusChangeInfo(null)}>{t('modals.status_change_confirmation.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={isLoading}>{isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}{t('modals.status_change_confirmation.continue_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              disabled={isLoading}
              className={refundDialogInfo?.shouldRefund ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {refundDialogInfo?.shouldRefund ? "Confirm Cancellation & Refund" : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// (Removed duplicate bottom declarations and hooks — types and helper are defined at the top)
