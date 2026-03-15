
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, Timestamp, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { toast } from '@/hooks/use-toast';
import type { Reservation } from '@/components/calendar/types';
import type { Payment } from '@/app/(app)/payments/page';
import type { Property } from '@/types/property';
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PaymentStatusBadge from '@/components/payments/payment-status-badge';
import { format, differenceInDays } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PaymentForm from '@/components/payments/payment-form';
import type { ManualPaymentData } from '@/components/payments/payment-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function PendingPaymentsPage() {
  const { user, isLoadingAuth } = useAuth();
  const router = useRouter();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [pendingReservations, setPendingReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation('pages/payments/pending/content');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentInitialData, setPaymentInitialData] = useState<Partial<ManualPaymentData> | null>(null);

  // New states for filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Partial'>('all');
  const [sortFilter, setSortFilter] = useState('check_in_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setPendingReservations([]);
      setPayments([]);
      setPropertySettings(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let activeListeners = 3;
    const doneLoading = () => {
        activeListeners--;
        if (activeListeners === 0) setIsLoading(false);
    };

    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      setPropertySettings(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Property : null);
      doneLoading();
    }, (err) => { console.error(err); doneLoading(); });


    const reservationsColRef = collection(db, "reservations");
    const qReservations = query(
      reservationsColRef,
      where("propertyId", "==", propertyId),
      where("paymentStatus", "in", ['Pending', 'Partial'])
    );
    const unsubReservations = onSnapshot(qReservations, (snapshot) => {
      const fetchedReservations = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startDate: (data.startDate as Timestamp).toDate(),
          endDate: (data.endDate as Timestamp).toDate(),
        } as Reservation;
      });
      setPendingReservations(fetchedReservations);
      doneLoading();
    }, (error) => {
      console.error("Error fetching pending reservations:", error);
      toast({ title: t('toasts.error_fetching_reservations.title'), description: t('toasts.error_fetching_reservations.description'), variant: "destructive" });
      doneLoading();
    });

    const paymentsColRef = collection(db, `properties/${propertyId}/payments`);
    const qPayments = query(paymentsColRef);
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
        const fetchedPayments = snapshot.docs.map(d => ({id: d.id, ...d.data()} as Payment));
        setPayments(fetchedPayments);
        doneLoading();
    }, (error) => {
      console.error("Error fetching payments:", error);
      toast({ title: t('toasts.error_fetching_payments.title'), description: t('toasts.error_fetching_payments.description'), variant: "destructive" });
      doneLoading();
    });

    return () => {
      unsubProp();
      unsubReservations();
      unsubPayments();
    };
  }, [propertyId, t]);

  const reservationsWithPaymentDetails = useMemo(() => {
    return pendingReservations.map(res => {
      const relevantPayments = payments.filter(p => p.reservationId === res.id);
      const totalPaid = relevantPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const amountDue = (res.totalPrice || 0) - totalPaid;
      return {
        ...res,
        totalPaid,
        amountDue,
      };
    });
  }, [pendingReservations, payments]);

  const filteredReservations = useMemo(() => {
    let filtered = reservationsWithPaymentDetails;

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter(res => 
        res.guestName?.toLowerCase().includes(lowercasedFilter) ||
        res.id.toLowerCase().includes(lowercasedFilter) ||
        res.reservationNumber?.toLowerCase().includes(lowercasedFilter)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(res => res.paymentStatus === statusFilter);
    }

    filtered.sort((a, b) => {
      switch (sortFilter) {
        case 'check_in_asc':
          return a.startDate.getTime() - b.startDate.getTime();
        case 'due_desc':
          return b.amountDue - a.amountDue;
        case 'due_asc':
          return a.amountDue - b.amountDue;
        default:
          return a.startDate.getTime() - b.startDate.getTime();
      }
    });

    return filtered;
  }, [reservationsWithPaymentDetails, searchTerm, statusFilter, sortFilter]);

  const paginatedReservations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredReservations.slice(startIndex, endIndex);
  }, [filteredReservations, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);

  const handleViewInvoice = (reservationId: string) => {
    router.push(`/payments/invoices?view_res=${reservationId}`);
  }

  const handleAddPayment = (reservation: any) => {
    setPaymentInitialData({
        reservationId: reservation.id,
        guestName: reservation.guestName,
        invoiceId: reservation.id, // Assuming invoice ID is same as reservation ID
        amountReceived: reservation.amountDue, // Pre-fill amount due
    });
    setIsPaymentModalOpen(true);
  };
  
  const handleSavePayment = async (paymentData: ManualPaymentData) => {
    if (!propertyId) {
        toast({ title: "Error", description: "Property ID not found.", variant: "destructive" });
        return;
    }
    setIsSaving(true);
    const functions = getFunctions(app, 'europe-west1');
    const createPayment = httpsCallable(functions, 'createPayment');
    try {
        const reservationId = paymentData.reservationId;
        const reservation = reservationsWithPaymentDetails.find(r => r.id === reservationId);

        const payload = {
            propertyId,
            guestName: reservation?.guestName || "N/A",
            guestId: reservation?.guestId || null,
            ...paymentData,
        };

        const result = await createPayment(payload);

        if ((result.data as any).success) {
            // After adding payment, check if reservation is fully paid
            if(reservation) {
                const newTotalPaid = reservation.totalPaid + paymentData.amountReceived;
                let newPaymentStatus: 'Paid' | 'Partial' = 'Partial';
                if (newTotalPaid >= (reservation.totalPrice || 0)) {
                    newPaymentStatus = 'Paid';
                }
                
                const resRef = doc(db, 'reservations', reservation.id);
                const invRef = doc(db, 'invoices', reservation.id);
                const batch = writeBatch(db);
                batch.update(resRef, { paymentStatus: newPaymentStatus });
                batch.update(invRef, { paymentStatus: newPaymentStatus });
                await batch.commit();
            }
             toast({ title: t('toasts.success_title'), description: t('toasts.payment_recorded_success_description') });
             setIsPaymentModalOpen(false);
        } else {
            throw new Error((result.data as any).error || "An unknown error occurred");
        }
       
    } catch (error) {
        console.error("Error saving payment:", error);
        toast({ title: "Error", description: (error as Error).message || "Could not record payment.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const currency = propertySettings?.currency || '$';

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
        <p className="ml-2">{t('loading')}</p>
      </div>
    );
  }

  if (!user?.permissions?.finance) {
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
    <>
      <div className="space-y-6 flex flex-col h-full">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
            </h1>
            <p className="text-muted-foreground">
            {t('description')}
            </p>
        </div>

        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>{t('outstanding_balances.title')}</CardTitle>
                    <CardDescription>
                        {t('outstanding_balances.found_reservations', { count: filteredReservations.length })}
                    </CardDescription>
                </div>
                 <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-2">
                    <Input 
                        placeholder={t('search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-auto sm:max-w-xs"
                    />
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder={t('filters.status.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('filters.status.all')}</SelectItem>
                            <SelectItem value="Pending">{t('filters.status.pending')}</SelectItem>
                            <SelectItem value="Partial">{t('filters.status.partial')}</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select value={sortFilter} onValueChange={setSortFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder={t('filters.sort.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="check_in_asc">{t('filters.sort.check_in_soonest')}</SelectItem>
                            <SelectItem value="due_desc">{t('filters.sort.amount_high_low')}</SelectItem>
                            <SelectItem value="due_asc">{t('filters.sort.amount_low_high')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {filteredReservations.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 bg-muted/50 rounded-lg">
                  <Icons.CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="mt-4 font-medium text-foreground">{t('no_pending')}</p>
                  <p className="text-sm text-muted-foreground">{t('all_paid')}</p>
              </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('table.guest')}</TableHead>
                                <TableHead>{t('table.dates')}</TableHead>
                                <TableHead className="text-right">{t('table.due')}</TableHead>
                                <TableHead>{t('table.status')}</TableHead>
                                <TableHead className="text-right">{t('table.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedReservations.map(res => (
                                <TableRow key={res.id}>
                                    <TableCell>
                                        <div className="font-medium">{res.guestName}</div>
                                        <div className="text-xs text-muted-foreground">{res.roomName} ({res.roomTypeName})</div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {format(res.startDate, "PP")}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-destructive">
                                        {currency}{res.amountDue.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <PaymentStatusBadge status={res.paymentStatus || 'Pending'} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => handleAddPayment(res)}>
                                            <Icons.CreditCard className="mr-2 h-4 w-4" /> {t('buttons.add_payment')}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
          </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-end space-x-6 p-2 border-t">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">{t('pagination.rows_per_page')}</p>
                        <Select
                            value={`${itemsPerPage}`}
                            onValueChange={(value) => {
                                setItemsPerPage(Number(value));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={`${itemsPerPage}`} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 25, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {t('pagination.page_of', { currentPage, totalPages })}
                    </span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('pagination.previous_button')}</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>{t('pagination.next_button')}</Button>
                    </div>
                </CardFooter>
            )}
        </Card>
      </div>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('payment_modal.title')}</DialogTitle>
                <DialogDescription>{t('payment_modal.description')}</DialogDescription>
            </DialogHeader>
            {propertyId && paymentInitialData && (
                <PaymentForm
                    propertyId={propertyId}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSave={handleSavePayment}
                    initialData={paymentInitialData}
                    isSaving={isSaving}
                />
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
