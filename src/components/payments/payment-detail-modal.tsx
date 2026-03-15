
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import PaymentStatusBadge from "./payment-status-badge";
import type { Payment, Invoice } from '@/app/(app)/payments/page';
import { format, parseISO } from 'date-fns';
import type { Property } from '@/types/property';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import type { Reservation } from '@/components/calendar/types';
import { Icons } from '../icons';

interface PaymentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  propertySettings: Property | null;
}

export default function PaymentDetailModal({ isOpen, onClose, payment, propertySettings }: PaymentDetailModalProps) {
  const { t } = useTranslation('pages/payments/list/content');
  const [associatedInvoice, setAssociatedInvoice] = useState<Invoice | null>(null);
  const [associatedReservation, setAssociatedReservation] = useState<Reservation | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (isOpen && payment) {
      const fetchDetails = async () => {
        setIsLoadingDetails(true);
        try {
          if (payment.invoiceId) {
            const invDoc = await getDoc(doc(db, 'invoices', payment.invoiceId));
            if (invDoc.exists()) setAssociatedInvoice({ id: invDoc.id, ...invDoc.data() } as Invoice);
          }
          if (payment.reservationId) {
            const resDoc = await getDoc(doc(db, 'reservations', payment.reservationId));
            if (resDoc.exists()) {
                const data = resDoc.data();
                setAssociatedReservation({ 
                    id: resDoc.id, ...data,
                    startDate: (data.startDate as Timestamp).toDate(),
                    endDate: (data.endDate as Timestamp).toDate()
                } as Reservation);
            }
          }
        } catch (error) {
          console.error("Failed to fetch associated details:", error);
        } finally {
          setIsLoadingDetails(false);
        }
      };
      fetchDetails();
    } else {
        setAssociatedInvoice(null);
        setAssociatedReservation(null);
    }
  }, [isOpen, payment]);

  if (!payment) return null;
  const currencySymbol = propertySettings?.currency || '$';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detail_modal.title')}</DialogTitle>
          <DialogDescription>
            {t('detail_modal.description', { transactionId: payment.paymentNumber || payment.id })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-48"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p className="font-medium text-foreground">{t('detail_modal.date_label')}</p>
                <p className="text-muted-foreground">{payment.date ? format(parseISO(payment.date), "PPP p") : 'N/A'}</p>
                
                <p className="font-medium text-foreground">{t('detail_modal.guest_name_label')}</p>
                <p className="text-muted-foreground">{payment.guestName}</p>

                <p className="font-medium text-foreground">{t('detail_modal.amount_paid_label')}</p>
                <p className="text-muted-foreground font-semibold">{currencySymbol}{payment.amountPaid.toFixed(2)}</p>

                <p className="font-medium text-foreground">{t('detail_modal.method_label')}</p>
                <p className="text-muted-foreground">{payment.paymentMethod}</p>
                
                <p className="font-medium text-foreground">{t('detail_modal.status_label')}</p>
                <PaymentStatusBadge status={payment.status} />
                
                {payment.reservationNumber && <>
                  <p className="font-medium text-foreground">{t('detail_modal.reservation_number_label')}</p>
                  <p className="text-muted-foreground">{payment.reservationNumber}</p>
                </>}

                {payment.invoiceId && <>
                  <p className="font-medium text-foreground">{t('detail_modal.invoice_id_label')}</p>
                  <p className="text-muted-foreground">{associatedInvoice?.invoiceNumber || payment.invoiceId}</p>
                </>}
            </div>
          )}
          
          {payment.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-foreground text-sm mb-1">{t('detail_modal.notes_label')}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{payment.notes}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">{t('detail_modal.close_button')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
