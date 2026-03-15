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
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, orderBy, deleteDoc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { ReservationStatus, Reservation, ReservationDisplayStatus } from '@/types/reservation';
import type { FirestoreUser } from '@/types/firestoreUser';
import type { Property } from '@/types/property';
import type { RoomType } from '@/types/roomType';
import type { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, format, parseISO, isWithinInterval } from 'date-fns';
import type { Room } from '@/types/room';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import type { Payment, Invoice } from '@/app/(app)/payments/page';
import type { ManualPaymentData } from '@/components/payments/payment-form';

const ReservationForm = dynamic(() => import('@/components/reservations/reservation-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});
const ReservationDetailModal = dynamic(() => import('@/components/reservations/reservation-detail-modal'), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const InvoiceViewModal = dynamic(() => import('@/components/payments/invoice-view-modal'), {
    loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});
const PaymentForm = dynamic(() => import('@/components/payments/payment-form'), {
    loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
    ssr: false,
});

export default function GroupsAndCorporateReservationsPage() {
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

  // Filtering and sorting state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<ReservationDisplayStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [checkinDateRange, setCheckinDateRange] = useState<DateRange | undefined>(undefined);
  const [checkoutDateRange, setCheckoutDateRange] = useState<DateRange | undefined>(undefined);

  // Modal and form state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  // Payment state
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Bulk delete state
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Permission check
  const canManageReservations = user?.permissions?.reservations || false;

  // Fetch property settings
  useEffect(() => {
    if (!user?.propertyId) {
      setIsLoading(false);
      return;
    }
    setPropertyId(user.propertyId);

    const fetchPropertySettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'properties', user.propertyId));
        if (docSnap.exists()) {
          setPropertySettings(docSnap.data() as Property);
        }
      } catch (error) {
        console.error('Error fetching property settings:', error);
      }
    };

    fetchPropertySettings();
  }, [user?.propertyId]);

  // Fetch group reservations (filter by groupBooking field)
  useEffect(() => {
    if (!user?.propertyId) {
      setReservations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const reservationsRef = collection(db, 'reservations');
    const q = query(
      reservationsRef,
      where('propertyId', '==', user.propertyId),
      where('groupBooking', '==', true),
      orderBy('startDate', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedReservations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Reservation));
        setReservations(fetchedReservations);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching reservations:', error);
        toast({ title: 'Error', description: 'Failed to load group reservations', variant: 'destructive' });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.propertyId]);

  // Fetch rooms
  useEffect(() => {
    if (!propertyId) return;

    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef, where('propertyId', '==', propertyId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Room));
      setAllRooms(fetchedRooms);
    });

    return () => unsubscribe();
  }, [propertyId]);

  // Fetch room types
  useEffect(() => {
    if (!propertyId) return;

    const roomTypesRef = collection(db, 'roomTypes');
    const q = query(roomTypesRef, where('propertyId', '==', propertyId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRoomTypes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RoomType));
      setRoomTypes(fetchedRoomTypes);
    });

    return () => unsubscribe();
  }, [propertyId]);

  // Fetch payments
  useEffect(() => {
    if (!propertyId) return;

    const paymentsRef = collection(db, 'payments');
    const q = query(paymentsRef, where('propertyId', '==', propertyId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPayments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Payment));
      setPayments(fetchedPayments);
    });

    return () => unsubscribe();
  }, [propertyId]);

  // Filter and search logic
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Filter by date range
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(r => {
        const startDate = r.startDate instanceof Timestamp ? r.startDate.toDate() : new Date(r.startDate);
        return isWithinInterval(startDate, { start: dateRange.from, end: dateRange.to });
      });
    }

    // Search by group name, guest name, or reservation number
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.guestName?.toLowerCase().includes(query) ||
        r.reservationNumber?.toLowerCase().includes(query) ||
        (r.groupName && r.groupName.toLowerCase().includes(query)))
      );
    }

    return filtered;
  }, [reservations, statusFilter, dateRange, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredReservations.length;
    const confirmed = filteredReservations.filter(r => r.status === 'Confirmed').length;
    const checkedIn = filteredReservations.filter(r => r.status === 'Checked-in').length;
    const upcoming = filteredReservations.filter(r => r.status === 'Pending' || r.status === 'Confirmed').length;

    const totalGuests = filteredReservations.reduce((sum, r) => {
      const adults = r.rooms?.reduce((s, room) => s + (room.adults || 0), 0) || 0;
      const children = r.rooms?.reduce((s, room) => s + (room.children || 0), 0) || 0;
      return sum + adults + children;
    }, 0);

    const totalRevenue = filteredReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    return { total, confirmed, checkedIn, upcoming, totalGuests, totalRevenue };
  }, [filteredReservations]);

  // Pagination
  const paginatedReservations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredReservations.slice(startIndex, endIndex);
  }, [filteredReservations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);

  // Handlers
  const handleOpenReservationForm = useCallback((reservation?: Reservation) => {
    if (reservation) {
      setEditingReservation(reservation);
    }
    setIsFormModalOpen(true);
  }, []);

  const handleViewReservationDetails = useCallback((reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsDetailModalOpen(true);
  }, []);

  const handleDeleteReservation = useCallback(async (reservationId: string) => {
    if (!propertyId) return;
    if (!confirm("Are you sure you want to permanently delete this group reservation? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, 'reservations', reservationId));
      toast({ title: 'Success', description: 'Group reservation deleted successfully' });
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast({ title: 'Error', description: 'Failed to delete group reservation', variant: 'destructive' });
    }
  }, [propertyId]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedReservationIds.size === 0) return;

    try {
      const batch = writeBatch(db);
      selectedReservationIds.forEach(id => {
        batch.delete(doc(db, 'reservations', id));
      });
      await batch.commit();
      setSelectedReservationIds(new Set());
      setIsDeleteConfirmOpen(false);
      toast({ title: 'Success', description: `${selectedReservationIds.size} group reservations deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast({ title: 'Error', description: 'Failed to delete reservations', variant: 'destructive' });
    }
  }, [selectedReservationIds]);

  const handleBulkStatusChange = useCallback(async (newStatus: ReservationStatus) => {
    if (selectedReservationIds.size === 0) return;

    try {
      const batch = writeBatch(db);
      selectedReservationIds.forEach(id => {
        batch.update(doc(db, 'reservations', id), { status: newStatus, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedReservationIds(new Set());
      toast({ title: 'Success', description: `${selectedReservationIds.size} reservations updated` });
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast({ title: 'Error', description: 'Failed to update reservations', variant: 'destructive' });
    }
  }, [selectedReservationIds]);

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards - Exact same styling as reservations/all */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Groups</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.total}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <Users size={18} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-cyan-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Guests</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.totalGuests}</h3>
            </div>
            <div className="p-2 rounded-lg bg-cyan-50">
              <Users size={18} className="text-cyan-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirmed</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{stats.confirmed}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Group Revenue</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{propertySettings?.currency || '$'}{stats.totalRevenue.toFixed(2)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-green-50">
              <DollarSign size={18} className="text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar and Filters Container */}
      <div className="bg-white rounded-lg p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
          <div className="relative flex-1 w-full">
              <Icons.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search by group name, guest, or booking #..." className="w-full pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
              <ReservationFilters 
                  roomTypes={roomTypes}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  roomTypeFilter={roomTypeFilter}
                  onRoomTypeFilterChange={setRoomTypeFilter}
                  bookedDateRange={dateRange}
                  onBookedDateRangeChange={setDateRange}
                  checkinDateRange={checkinDateRange}
                  onCheckinDateRangeChange={setCheckinDateRange}
                  checkoutDateRange={checkoutDateRange}
                  onCheckoutDateRangeChange={setCheckoutDateRange}
              />
              <Dialog open={isFormModalOpen} onOpenChange={(isOpen) => { setIsFormModalOpen(isOpen); if (!isOpen) setEditingReservation(null); }}>
                  <DialogTrigger asChild>
                      <Button onClick={() => handleOpenReservationForm()} disabled={!propertyId || isLoading || !canManageReservations}>
                      <Icons.PlusCircle className="mr-2 h-4 w-4" /> New Group Booking
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-5xl p-0 h-[90vh] flex flex-col">
                    <DialogHeader className="px-6 pt-6">
                      <DialogTitle>{editingReservation ? 'Edit Group Reservation' : 'Create Group Reservation'}</DialogTitle>
                      <DialogDescription>{editingReservation ? 'Update group booking details' : 'Create a new group or corporate reservation'}</DialogDescription>
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

      {/* Group Reservations List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <ReservationList
          reservations={paginatedReservations}
          payments={payments}
          isLoading={isLoading}
          onEditReservation={handleOpenReservationForm}
          onViewReservation={handleViewReservationDetails}
          onDeleteReservation={handleDeleteReservation}
          onAddPayment={() => setIsPaymentFormOpen(true)}
          onViewInvoice={(invoice) => {
            setSelectedInvoice(invoice);
            setIsInvoiceModalOpen(true);
          }}
          onCancelReservation={handleViewReservationDetails}
          onCheckIn={() => {}}
          onCheckOut={() => {}}
          canManage={canManageReservations}
          propertyCurrency={propertySettings?.currency}
          currentPropertyId={propertyId}
          currentPage={currentPage}
          totalPages={totalPages}
          onNextPage={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
          onPrevPage={() => setCurrentPage(p => Math.max(p - 1, 1))}
          reservationsPerPage={itemsPerPage}
          onReservationsPerPageChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
          totalFilteredCount={filteredReservations.length}
          bulkActions={['delete', 'changeStatus']}
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={handleBulkStatusChange}
          propertySettings={propertySettings}
        />
      </div>

      {/* Modals */}
      {selectedReservation && (
        <ReservationDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedReservation(null);
          }}
          reservation={selectedReservation}
          onEdit={() => {
            handleOpenReservationForm(selectedReservation);
            setIsDetailModalOpen(false);
          }}
          onDelete={() => {
            handleDeleteReservation(selectedReservation.id);
            setIsDetailModalOpen(false);
          }}
          onAddPayment={() => setIsPaymentFormOpen(true)}
          payments={payments}
          onViewInvoice={(invoice) => {
            setSelectedInvoice(invoice);
            setIsInvoiceModalOpen(true);
          }}
        />
      )}

      {isPaymentFormOpen && selectedReservation && (
        <Dialog open={isPaymentFormOpen} onOpenChange={setIsPaymentFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Payment</DialogTitle>
              <DialogDescription>Record a payment for group reservation {selectedReservation.reservationNumber}</DialogDescription>
            </DialogHeader>
            <PaymentForm
              reservationId={selectedReservation.id}
              guestName={selectedReservation.guestName}
              amount={selectedReservation.totalPrice}
              onSuccess={() => {
                setIsPaymentFormOpen(false);
                setSelectedReservation(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {selectedInvoice && (
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoice(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group Reservations</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedReservationIds.size} group reservation(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
