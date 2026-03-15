

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import PaymentsFilters from "@/components/payments/payments-filters";
import PaymentsTable from "@/components/payments/payments-table";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { db, app } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy, doc, writeBatch, serverTimestamp, deleteDoc, addDoc } from 'firebase/firestore';
import type { Payment, Invoice } from '@/app/(app)/payments/page';
import { useAuth } from '@/contexts/auth-context';
import type { Property } from '@/types/property';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import type { ManualPaymentData } from '@/components/payments/payment-form';
import { getFunctions, httpsCallable } from 'firebase/functions';

const PaymentForm = dynamic(() => import('@/components/payments/payment-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const PaymentDetailModal = dynamic(() => import('@/components/payments/payment-detail-modal'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const RefundForm = dynamic(() => import('@/components/payments/refund-form'), {
    loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
    ssr: false,
});


export default function PaymentsListPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation(['pages/payments/list/content', 'pages/payments/process_refund']);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);

  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [currentFilters, setCurrentFilters] = useState<{
    dateRange?: { from?: Date; to?: Date };
    paymentStatus?: string;
    paymentMethod?: string;
    searchTerm?: string;
  }>({});

  const [isPaymentFormModalOpen, setIsPaymentFormModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isViewPaymentModalOpen, setIsViewPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [paymentsToDelete, setPaymentsToDelete] = useState<string[]>([]);
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);
  const [statusChangeInfo, setStatusChangeInfo] = useState<{ ids: string[]; status: Payment['status'] } | null>(null);
  
  const [paymentToRefund, setPaymentToRefund] = useState<Payment | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const canManage = user?.permissions?.finance;

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setPropertySettings(null);
      return;
    }
    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPropertySettings({ id: docSnap.id, ...docSnap.data() } as Property);
      } else {
        setPropertySettings(null);
      }
    });

    return () => unsubProp();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setAllPayments([]);
      setInvoices([]);
      setIsLoadingData(true);
      return;
    }

    setIsLoadingData(true);
    let listenersCount = 2;
    const checkDoneLoading = () => {
        listenersCount--;
        if (listenersCount <= 0) {
            setIsLoadingData(false);
        }
    };
    
    const invoicesQuery = query(collection(db, "invoices"), where("propertyId", "==", propertyId));
    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
        setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
        checkDoneLoading();
    }, (err) => {
        console.error("Error fetching invoices:", err);
        toast({ title: "Error", description: t('toasts.error_fetching_invoices'), variant: "destructive" });
        checkDoneLoading();
    });

    const paymentsQuery = query(collection(db, `properties/${propertyId}/payments`), orderBy("date", "desc"));
    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      setAllPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      checkDoneLoading();
    }, (err) => {
      console.error("Error fetching payments:", err);
      toast({ title: "Error", description: t('toasts.error_fetching_payments'), variant: "destructive" });
      checkDoneLoading();
    });

    return () => {
      unsubPayments();
      unsubInvoices();
    };
  }, [propertyId, t]);

  const filteredAndSortedPayments = useMemo(() => {
    let filtered = [...allPayments];
    
    // Apply search filter
    if (currentFilters.searchTerm) {
        const lowercasedTerm = currentFilters.searchTerm.toLowerCase();
        filtered = filtered.filter(p => 
            p.guestName.toLowerCase().includes(lowercasedTerm) || 
            (p.paymentNumber && p.paymentNumber.toLowerCase().includes(lowercasedTerm)) ||
            (p.reservationId && p.reservationId.toLowerCase().includes(lowercasedTerm)) ||
            (p.invoiceId && p.invoiceId.toLowerCase().includes(lowercasedTerm))
        );
    }
    // Apply status filter
    if (currentFilters.paymentStatus) {
        filtered = filtered.filter(p => p.status === currentFilters.paymentStatus);
    }
    // Apply method filter
    if (currentFilters.paymentMethod) {
        filtered = filtered.filter(p => p.paymentMethod === currentFilters.paymentMethod);
    }
    // Apply date range filter
    if (currentFilters.dateRange?.from) {
        const from = startOfDay(currentFilters.dateRange.from);
        filtered = filtered.filter(p => parseISO(p.date) >= from);
    }
    if (currentFilters.dateRange?.to) {
        const to = endOfDay(currentFilters.dateRange.to);
        filtered = filtered.filter(p => parseISO(p.date) <= to);
    }

    // Apply sorting
    return filtered.sort((a, b) => {
        const valA = (a as any)[sortBy];
        const valB = (b as any)[sortBy];

        if (sortBy === 'date') {
            const dateA = valA ? parseISO(valA).getTime() : 0;
            const dateB = valB ? parseISO(valB).getTime() : 0;
            return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        return 0;
    });
  }, [allPayments, currentFilters, sortBy, sortDirection]);
  
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedPayments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedPayments.length / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };
  
  const handleFilterChange = useCallback((filters: any) => {
    setCurrentPage(1);
    setCurrentFilters(filters);
  }, []);
  
  const handleSortChange = (column: string) => {
    if (sortBy === column) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortBy(column);
        setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsViewPaymentModalOpen(true);
  };
  
  const handleDeletePayment = (paymentId: string) => {
    if (!canManage) return;
    setPaymentsToDelete([paymentId]);
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDelete = (paymentIds: string[]) => {
    if (!canManage) return;
    setPaymentsToDelete(paymentIds);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (paymentsToDelete.length === 0 || !canManage) return;
    setIsLoadingData(true);
    try {
      const batch = writeBatch(db);
      paymentsToDelete.forEach(id => {
        batch.delete(doc(db, `properties/${propertyId}/payments`, id));
      });
      await batch.commit();
      toast({ title: "Success", description: t('toasts.delete_success', { count: paymentsToDelete.length }) });
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast({ title: "Error", description: t('toasts.delete_error'), variant: "destructive" });
    } finally {
      setIsLoadingData(false);
      setIsDeleteDialogOpen(false);
      setPaymentsToDelete([]);
    }
  };

  const handleBulkStatusChange = (paymentIds: string[], status: Payment['status']) => {
    if (!canManage) return;
    setStatusChangeInfo({ ids: paymentIds, status });
    setIsStatusChangeDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!statusChangeInfo || !canManage) return;
    setIsLoadingData(true);
    try {
      const batch = writeBatch(db);
      statusChangeInfo.ids.forEach(id => {
        batch.update(doc(db, `properties/${propertyId}/payments`, id), { status: statusChangeInfo.status, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      toast({ title: "Success", description: t('toasts.status_success', { count: statusChangeInfo.ids.length, status: statusChangeInfo.status }) });
    } catch (err) {
      console.error("Bulk status change error:", err);
      toast({ title: "Error", description: t('toasts.status_error'), variant: "destructive" });
    } finally {
      setIsLoadingData(false);
      setIsStatusChangeDialogOpen(false);
      setStatusChangeInfo(null);
    }
  };
  
  const handleSavePayment = async (paymentData: ManualPaymentData) => {
    if (!propertyId) return;
    setIsSaving(true);
    const functions = getFunctions(app, 'europe-west1');
    const createPayment = httpsCallable(functions, 'createPayment');
    try {
        const payload = {
            ...paymentData,
            propertyId,
        };
        const result = await createPayment(payload);

        if ((result.data as any).success) {
             toast({ title: "Success", description: "Payment recorded successfully." });
             setIsPaymentFormModalOpen(false);
        } else {
            throw new Error((result.data as any).error || "An unknown error occurred");
        }
       
    } catch (error) {
        console.error("Error saving payment:", error);
        toast({ title: "Error", description: (error as Error).message || "Could not save payment.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleInitiateRefund = (payment: Payment) => {
    setPaymentToRefund(payment);
    setIsRefundModalOpen(true);
  };

  const handleConfirmRefund = async (reason: string, amount: number) => {
    if (!paymentToRefund) return;
    setIsProcessingRefund(true);
    try {
        const functions = getFunctions(app, 'europe-west1');
        const createRefund = httpsCallable(functions, 'createRefund');
        
        await createRefund({
            originalPaymentId: paymentToRefund.id,
            refundAmount: amount,
            reason: reason,
        });

        toast({ title: "Success", description: "Refund processed successfully."});
        setPaymentToRefund(null);
        setIsRefundModalOpen(false);
    } catch (error: any) {
        console.error("Refund processing error:", error);
        toast({ title: "Error", description: error.message || "Could not process refund.", variant: "destructive"});
    } finally {
        setIsProcessingRefund(false);
    }
  };


  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.finance) {
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
            <Dialog open={isPaymentFormModalOpen} onOpenChange={setIsPaymentFormModalOpen}>
                <DialogTrigger asChild>
                    <Button disabled={!canManage}>
                      <Icons.PlusCircle className="mr-2 h-4 w-4" /> {t('add_payment_button')}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('payment_form.title')}</DialogTitle>
                        <DialogDescription>{t('payment_form.description')}</DialogDescription>
                    </DialogHeader>
                    {propertyId && (
                        <PaymentForm 
                            propertyId={propertyId}
                            onClose={() => setIsPaymentFormModalOpen(false)}
                            onSave={handleSavePayment}
                            isSaving={isSaving}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <PaymentsFilters onFilterChange={handleFilterChange} />
      <PaymentsTable 
        payments={paginatedPayments} 
        invoices={invoices}
        isLoading={isLoadingData}
        onViewPayment={handleViewPayment} 
        onDeletePayment={handleDeletePayment}
        onRefundPayment={handleInitiateRefund}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalPages={totalPages}
        onItemsPerPageChange={handleItemsPerPageChange}
        onNextPage={handleNextPage}
        onPreviousPage={handlePreviousPage}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortDirection={sortDirection}
        propertySettings={propertySettings}
        onBulkDelete={handleBulkDelete}
        onBulkStatusChange={handleBulkStatusChange}
        canManage={canManage}
      />
      
      <PaymentDetailModal
        isOpen={isViewPaymentModalOpen}
        onClose={() => setIsViewPaymentModalOpen(false)}
        payment={selectedPayment}
        propertySettings={propertySettings}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { count: paymentsToDelete.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPaymentsToDelete([])}>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoadingData}>
              {isLoadingData && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete_dialog.continue_button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isStatusChangeDialogOpen} onOpenChange={setIsStatusChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('status_change_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
             {t('status_change_dialog.description', { count: statusChangeInfo?.ids.length, status: statusChangeInfo?.status })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStatusChangeInfo(null)}>{t('status_change_dialog.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={isLoadingData}>
              {isLoadingData && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {t('status_change_dialog.confirm_button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <Dialog open={isRefundModalOpen} onOpenChange={(isOpen) => { if(!isOpen) setPaymentToRefund(null); setIsRefundModalOpen(isOpen); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages/payments/process_refund:title')}</DialogTitle>
            <DialogDescription>
             {t('pages/payments/process_refund:description', { guestName: paymentToRefund?.guestName })}
            </DialogDescription>
          </DialogHeader>
          {paymentToRefund && <RefundForm payment={paymentToRefund} onConfirm={handleConfirmRefund} isProcessing={isProcessingRefund} currencySymbol={propertySettings?.currency || '$'} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    

    
