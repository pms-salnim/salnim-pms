
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icons } from "@/components/icons";
import { toast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { format, parseISO } from 'date-fns';
import type { Payment } from '@/app/(app)/payments/page';
import PaymentStatusBadge from '@/components/payments/payment-status-badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RefundForm from '@/components/payments/refund-form';

export default function RefundsPage() {
  const { user, property } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const { t } = useTranslation('pages/payments/refunds/content');

  useEffect(() => {
    if (!user?.propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const paymentsQuery = query(
      collection(db, `properties/${user.propertyId}/payments`), 
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(paymentsQuery, (snapshot) => {
      const fetchedPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(fetchedPayments);
      setIsLoading(false);
    });
    return () => unsub();
  }, [user?.propertyId]);

  const refundablePayments = useMemo(() => payments.filter(p => p.status === 'Paid' && !p.isRefund), [payments]);
  const refundedPayments = useMemo(() => payments.filter(p => p.isRefund), [payments]);
  
  const handleRefund = async (reason: string, amount: number) => {
    if (!selectedPayment) return;
    setIsProcessing(true);
    
    try {
        const functions = getFunctions(app, 'europe-west1');
        const createRefund = httpsCallable(functions, 'createRefund');
        
        await createRefund({
            originalPaymentId: selectedPayment.id,
            refundAmount: amount,
            reason: reason,
        });

        toast({ title: t('toasts.success_title'), description: t('toasts.refund_success_description')});
        setSelectedPayment(null); // Close modal
    } catch (error: any) {
        console.error("Refund processing error:", error);
        toast({ title: t('toasts.error_title'), description: error.message || t('toasts.refund_error_description'), variant: "destructive"});
    } finally {
        setIsProcessing(false);
    }
  };

  if (!user?.permissions?.finance) {
    return <Alert variant="destructive"><Icons.AlertCircle className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to access this page.</AlertDescription></Alert>;
  }

  const currencySymbol = property?.currency || '$';

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>{t('refundable_payments.title')}</CardTitle>
                <CardDescription>{t('refundable_payments.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('table_headers.date')}</TableHead>
                                <TableHead>{t('table_headers.guest')}</TableHead>
                                <TableHead className="text-right">{t('table_headers.amount')}</TableHead>
                                <TableHead>{t('table_headers.method')}</TableHead>
                                <TableHead className="text-right">{t('table_headers.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></TableCell></TableRow>
                            ) : refundablePayments.length > 0 ? (
                                refundablePayments.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{format(parseISO(p.date), 'PP')}</TableCell>
                                        <TableCell>{p.guestName}</TableCell>
                                        <TableCell className="text-right">{currencySymbol}{p.amountPaid.toFixed(2)}</TableCell>
                                        <TableCell>{p.paymentMethod}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="destructive" size="sm" onClick={() => setSelectedPayment(p)}>
                                                <Icons.Undo2 className="mr-2 h-4 w-4" /> {t('buttons.refund')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">{t('refundable_payments.empty_state')}</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>{t('refunded_payments.title')}</CardTitle>
                <CardDescription>{t('refunded_payments.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('table_headers.date')}</TableHead>
                                <TableHead>{t('table_headers.guest')}</TableHead>
                                <TableHead>{t('table_headers.method')}</TableHead>
                                <TableHead className="text-right">{t('table_headers.refunded_amount')}</TableHead>
                                <TableHead>{t('table_headers.notes')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></TableCell></TableRow>
                            ) : refundedPayments.length > 0 ? (
                                refundedPayments.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{format(parseISO(p.date), 'PP')}</TableCell>
                                        <TableCell>{p.guestName}</TableCell>
                                        <TableCell>{p.paymentMethod}</TableCell>
                                        <TableCell className="text-right text-destructive">{currencySymbol}{(p.amountPaid).toFixed(2)}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={p.notes}>{p.notes}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">{t('refunded_payments.empty_state')}</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>

       <Dialog open={!!selectedPayment} onOpenChange={(isOpen) => !isOpen && setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('refund_form.title')}</DialogTitle>
            <DialogDescription>
             {t('refund_form.description', { guestName: selectedPayment?.guestName })}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && <RefundForm payment={selectedPayment} onConfirm={handleRefund} isProcessing={isProcessing} currencySymbol={currencySymbol}/>}
        </DialogContent>
      </Dialog>
    </>
  );
}
