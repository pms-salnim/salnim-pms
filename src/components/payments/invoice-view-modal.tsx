
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import type { Invoice, Payment } from '@/app/(app)/payments/page'; 
import { format, parseISO, differenceInDays, isToday } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import { generateInvoicePdf } from '@/lib/pdfGenerator';
import type { Property } from '@/types/property';
import { toast } from '@/hooks/use-toast';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, type Timestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import type { Reservation, SelectedExtra, ReservationRoom, Promotion } from '@/components/calendar/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import SendEmailDialog from '../reservations/send-email-dialog';
import { Mail, Phone } from 'lucide-react';

interface InvoiceViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  propertySettings: Property | null;
  onEdit?: (invoice: Invoice) => void;
  canManage?: boolean;
}

export default function InvoiceViewModal({ isOpen, onClose, invoice, propertySettings, onEdit, canManage }: InvoiceViewModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchedInvoice, setFetchedInvoice] = useState<Invoice | null>(null);
  const { t, i18n } = useTranslation(['pages/payments/invoices/content', 'pdf_content', 'status/status_content']);
  const locale = i18n.language === 'fr' ? fr : enUS;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  

  useEffect(() => {
    if (isOpen && invoice?.id) {
      const invoiceId = invoice.id;
      const invoiceDocRef = doc(db, 'invoices', invoiceId);
      
      const fetchInvoiceAndPayments = async () => {
        try {
          const invoiceDocSnap = await getDoc(invoiceDocRef);
          if (invoiceDocSnap.exists()) {
            const invoiceData = invoiceDocSnap.data() as Invoice;
            setFetchedInvoice({ id: invoiceDocSnap.id, ...invoiceData } as Invoice);

            const reservationId = invoiceData.reservationId;
            const propertyId = invoiceData.propertyId;
            if (reservationId && propertyId) {
                const paymentsQuery = query(collection(db, `properties/${propertyId}/payments`), where('reservationId', '==', reservationId));
                const paymentSnap = await getDocs(paymentsQuery);
                setPayments(paymentSnap.docs.map(d => ({id: d.id, ...d.data()} as Payment)));
            } else {
                setPayments([]);
            }
          } else {
            setFetchedInvoice(null);
            setPayments([]);
          }
        } catch (error) {
           console.error("Failed to fetch invoice and payments:", error);
           setFetchedInvoice(null);
           setPayments([]);
        }
      };

      if (invoice.reservationId) {
        const resDocRef = doc(db, 'reservations', invoice.reservationId);
        const fetchReservation = async () => {
          const resDocSnap = await getDoc(resDocRef);
          if (resDocSnap.exists()) {
            const data = resDocSnap.data();
            setReservation({ id: resDocSnap.id, ...data, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation)
          }
        }
        fetchReservation();
      }
      
      fetchInvoiceAndPayments();
    } else {
      setFetchedInvoice(null);
      setReservation(null);
      setPayments([]);
    }
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const currencySymbol = propertySettings?.currency || '$';
  
  const discountAmount = invoice.discountAmount || 0;
  
  const grandTotal = invoice.amount;
  const subtotal = invoice.subtotal || 0;
  const taxAmount = invoice.taxAmount || 0;

  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amountPaid, 0);
  const amountDue = grandTotal - totalPaid;
  
  const handleDownload = async () => {
    if (!invoice || !propertySettings) {
        toast({ title: t('toasts.error_title'), description: "Invoice or property data is missing.", variant: "destructive" });
        return;
    }
    setIsProcessing(true);
    let resData = reservation;
    if (!resData && invoice.reservationId) {
         const resDocRef = doc(db, 'reservations', invoice.reservationId);
         const resDocSnap = await getDoc(resDocRef);
         if (resDocSnap.exists()) {
             const data = resDocSnap.data();
             resData = { ...data, id: resDocSnap.id, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation;
         }
    }

    try {
        await i18n.loadNamespaces(['pdf_content', 'status/status_content']);
        const pdf = await generateInvoicePdf(invoice, propertySettings, resData, payments, t);
        pdf.save(`invoice-${invoice.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.pdf_download_error'), variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (!invoice || !propertySettings || !fetchedInvoice) {
      toast({ title: t('toasts.error_title'), description: t('toasts.send_email_missing_data'), variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);

    let recipientEmail = '';
    let reservationData: Reservation | null = reservation;

    try {
        if (!reservationData && invoice.reservationId) {
            const resDocSnap = await getDoc(doc(db, 'reservations', invoice.reservationId));
            if (resDocSnap.exists()) {
                const data = resDocSnap.data();
                reservationData = { ...data, id: resDocSnap.id, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation;
            }
        }

        if (reservationData?.guestEmail) {
            recipientEmail = reservationData.guestEmail;
        } else if (invoice.guestId) {
            const guestDocSnap = await getDoc(doc(db, 'guests', invoice.guestId));
            if (guestDocSnap.exists() && guestDocSnap.data().email) {
                recipientEmail = guestDocSnap.data().email;
            }
        }

        if (!recipientEmail) {
            throw new Error(t('toasts.guest_email_not_found'));
        }
      
        const pdf = await generateInvoicePdf(fetchedInvoice, propertySettings, reservationData, payments, t);
        const pdfDataUri = pdf.output('datauristring');
        
        const functions = getFunctions(app, 'europe-west1');
        const sendInvoiceByEmail = httpsCallable(functions, 'sendInvoiceByEmail');
        
        const result: any = await sendInvoiceByEmail({
            propertyId: propertySettings.id,
            invoice,
            recipientEmail,
            pdfDataUri,
        });

        if (result.data.success) {
          toast({
              title: "Email Sent",
              description: `Invoice has been successfully sent to ${recipientEmail}.`,
          });
        } else {
            throw new Error(result.data.message || 'An unknown error occurred while sending the email.');
        }

    } catch (error: any) {
        console.error("Error sending email:", error);
        toast({
            title: "Failed to Send Email",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleOpenSendEmailDialog = () => {
    if (!reservation) {
      toast({
        title: t('toasts.no_reservation_title'),
        description: t('toasts.no_reservation_description'),
        variant: "destructive",
      });
      return;
    }
    setIsSendEmailModalOpen(true);
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('view_modal.title', { number: invoice.invoiceNumber })}</DialogTitle>
            <DialogDescription>
              {t('view_modal.description', { guest: invoice.guestOrCompany, date: format(parseISO(invoice.dateIssued), "PPP", { locale }) })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">{t('view_modal.bill_to_heading')}</h4>
                <p>{invoice.guestOrCompany}</p>
                {invoice.reservationId && <p className="text-sm text-muted-foreground">{t('view_modal.reservation_label')}: {reservation?.reservationNumber || invoice.reservationId}</p>}
              </div>
              <div className="text-right">
                <p>{t('view_modal.date_issued_label')}: {format(parseISO(invoice.dateIssued), "PPP", { locale })}</p>
                <p>{t('view_modal.due_date_label')}: {format(parseISO(invoice.dueDate), "PPP", { locale })}</p>
                <PaymentStatusBadge status={invoice.paymentStatus} className="mt-1 inline-flex"/>
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <h4 className="font-semibold mb-2">{t('view_modal.items_heading')}:</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1">{t('view_modal.table_headers.description')}</th>
                    <th className="text-center pb-1">{t('view_modal.table_headers.qty')}</th>
                    <th className="text-right pb-1">{t('view_modal.table_headers.unit_price')}</th>
                    <th className="text-right pb-1">{t('view_modal.table_headers.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="py-1">{item.description}</td>
                      <td className="text-center py-1">{item.quantity}</td>
                      <td className="text-right py-1">{currencySymbol}{item.unitPrice.toFixed(2)}</td>
                      <td className="text-right py-1">{currencySymbol}{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {invoice.lineItems.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">{t('view_modal.no_line_items')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                  {invoice.notes && (
                      <>
                          <h4 className="font-semibold text-sm">{t('view_modal.notes_heading')}:</h4>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                      </>
                  )}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between font-medium">
                    <span>{t('view_modal.subtotal_label')}:</span>
                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="font-medium flex items-center gap-1.5">
                        <Icons.Tag className="h-3 w-3" />
                        {t('view_modal.discount_label', { name: reservation?.promotionApplied?.name || 'Promo' })}
                    </span>
                    <span className="font-medium">-{currencySymbol}{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                 <div className="flex justify-between font-bold">
                    <span>{t('pdf_content:net_amount_label')}:</span>
                    <span>{currencySymbol}{(subtotal - discountAmount).toFixed(2)}</span>
                  </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('view_modal.tax_label', { name: propertySettings?.taxSettings?.name || 'Tax', rate: propertySettings?.taxSettings?.rate || 0 })}:</span>
                    <span>{currencySymbol}{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-1.5"/>
                <div className="flex justify-between font-bold text-base"><span>{t('view_modal.grand_total_label')}:</span><span>{currencySymbol}{grandTotal.toFixed(2)}</span></div>
                {totalPaid > 0 && (<div className="flex justify-between text-green-600"><span>{t('pdf_content:total_paid')}:</span><span>-{currencySymbol}{totalPaid.toFixed(2)}</span></div>)}
                {(invoice.paymentStatus === 'Pending' || invoice.paymentStatus === 'Partial' || amountDue < 0) && (
                    <div className="flex justify-between font-bold text-base text-destructive"><span>{t('pdf_content:amount_due_label')}:</span><span>{currencySymbol}{amountDue.toFixed(2)}</span></div>
                )}
              </div>
            </div>

          </div>

          <DialogFooter className="sm:justify-between flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
             <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleDownload} disabled={isProcessing || !fetchedInvoice}>
                      {isProcessing ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/> : <Icons.Download className="mr-2 h-4 w-4" />}
                  {t('view_modal.buttons.download_pdf')}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isProcessing}>
                        <Icons.Mail className="mr-2 h-4 w-4" /> {t('view_modal.buttons.send_email')} <Icons.DropdownArrow className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleSendInvoiceEmail} disabled={!fetchedInvoice || (!reservation?.guestEmail && !invoice?.guestEmail)}>
                        <Icons.FilePlus2 className="mr-2 h-4 w-4" /> {t('view_modal.buttons.email_invoice')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleOpenSendEmailDialog} disabled={!reservation}>
                        <Icons.Mail className="mr-2 h-4 w-4" /> {t('view_modal.buttons.other_templates')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              </div>
              <div className="flex flex-wrap gap-2">
                  {canManage && onEdit && (
                      <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                              onClose(); // Close this modal
                              onEdit(invoice); // Open the edit modal
                          }}
                      >
                          <Icons.Edit className="mr-2 h-4 w-4" /> {t('view_modal.buttons.edit')}
                      </Button>
                  )}
                  <DialogClose asChild>
                      <Button type="button" variant="secondary">{t('view_modal.buttons.close')}</Button>
                  </DialogClose>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       {isSendEmailModalOpen && reservation && (
          <SendEmailDialog
              isOpen={isSendEmailModalOpen}
              onClose={() => setIsSendEmailModalOpen(false)}
              reservation={reservation}
              propertySettings={propertySettings}
          />
       )}
    </>
  );
}
