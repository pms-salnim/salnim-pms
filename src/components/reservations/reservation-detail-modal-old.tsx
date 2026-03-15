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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ReservationStatusBadge from "./reservation-status-badge";
import type { Reservation, SelectedExtra, ReservationRoom } from '@/types/reservation';
import type { Promotion } from '@/types/promotion';
import { format, parseISO, differenceInDays, isToday } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { enUS, fr } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import type { Property } from '@/types/property';
import { generateInvoicePdf } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, type Timestamp, query, collection, where, limit, getDocs, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Invoice, Payment } from '@/app/(app)/payments/page';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import SendEmailDialog from './send-email-dialog';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import { useTranslation } from 'react-i18next';
import { 
  Mail, 
  Phone, 
  BedDouble, 
  Calendar as CalendarIcon, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Tag,
  Globe,
  Users,
  MessageSquare,
  ClipboardList,
  CreditCard,
  Zap
} from 'lucide-react';
import PaymentStatusBadge from '../payments/payment-status-badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

// --- Types & Interfaces ---

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Reservation | null;
  propertySettings: Property | null;
  onEdit?: (reservation: Reservation) => void;
  onCheckIn?: (reservationId: string) => void;
  onCheckOut?: (reservation: Reservation) => void;
  canManage?: boolean;
}

const DetailSection = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon size={14} />
            {title}
        </div>
        <div className="space-y-2">
            {children}
        </div>
    </div>
);

const InfoRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-slate-500">{label}:</span>
        <span className="text-slate-800 font-medium text-right truncate">{children}</span>
    </div>
);

const RoomCard = ({ 
  room, 
  index, 
  currencySymbol, 
  nights, 
  t, 
  calculateExtraItemTotal 
}: { 
  room: ReservationRoom, 
  index: number, 
  currencySymbol: string, 
  nights: number, 
  t: any, 
  calculateExtraItemTotal: (extra: SelectedExtra) => { total: number, breakdown: string } 
}) => {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const roomRate = room.price || 0;
  const extrasTotal = room.selectedExtras?.reduce((acc, extra) => acc + calculateExtraItemTotal(extra).total, 0) || 0;
  const total = roomRate + extrasTotal;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-4 shadow-sm transition-all hover:shadow-md">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
             <BedDouble size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-2">
              {room.roomTypeName}
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {room.roomName}
              </span>
            </h4>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{t('sections.stay_details.guest_count', { adults: room.adults, children: room.children })}</span>
              <span>•</span>
              <span>{room.ratePlanName || 'Standard Rate'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-medium text-slate-800">{currencySymbol}{total.toFixed(2)}</div>
            <div className="text-xs text-slate-500">{t('nights', { count: nights })}</div>
          </div>
          {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center text-sm mb-2 text-slate-600">
            <span className="flex items-center gap-2">
              <BedDouble size={16} className="text-slate-400" />
              <span>{t('sections.pricing_summary.room_rate')}</span>
            </span>
            <span className="font-medium">{currencySymbol}{roomRate.toFixed(2)}</span>
          </div>
          {extrasTotal > 0 && (
            <div className="flex justify-between items-center text-sm mb-3 text-slate-600">
                <span className="flex items-center gap-2">
                    <Icons.CheckCircle2 size={16} className="text-slate-400" />
                    <span>{t('sections.pricing_summary.extras_total')}</span>
                </span>
                <span className="font-medium">{currencySymbol}{extrasTotal.toFixed(2)}</span>
            </div>
          )}
          {room.selectedExtras && room.selectedExtras.length > 0 && (
            <div className="mt-4">
              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('sections.extras.title')}</h5>
              <div className="space-y-2">
                {room.selectedExtras.map((extra) => {
                  const calculation = calculateExtraItemTotal(extra);
                  return (
                    <div key={extra.id} className="flex justify-between items-center text-sm bg-white p-2.5 rounded border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-full bg-blue-50 text-blue-600">
                           <Icons.CheckCircle2 size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-700 font-medium">
                                {extra.name}
                                {extra.quantity > 1 && <span className="text-slate-400 text-xs ml-1">× {extra.quantity}</span>}
                            </span>
                            <span className="text-[10px] text-slate-400">{calculation.breakdown}</span>
                        </div>
                      </div>
                      <span className="text-slate-600 font-semibold">
                        {currencySymbol}{calculation.total.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// --- Main Component ---

export default function ReservationDetailModal({ isOpen, onClose, initialData, propertySettings, onEdit, canManage, onCheckIn, onCheckOut }: ReservationDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchedInvoice, setFetchedInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const { t, i18n } = useTranslation(['pages/dashboard/reservation-details-modal-content', 'pdf_content', 'status/status_content']);
  const locale = i18n.language === 'fr' ? fr : enUS;

  const [includedServices, setIncludedServices] = useState<Service[]>([]);
  const [includedMealPlans, setIncludedMealPlans] = useState<MealPlan[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [refundDialogInfo, setRefundDialogInfo] = useState<{ reservationId: string; reservation: Reservation; shouldRefund: boolean; refundAmount: number } | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  
  const [reservation, setReservation] = useState<Reservation | null>(initialData);
  const currencySymbol = propertySettings?.currency || '$';

  // --- Logic & Effects ---

  const calculateExtraItemTotal = useCallback((extra: SelectedExtra) => {
    if (!reservation) return { total: 0, breakdown: '' };
    const nights = differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date);
    if (nights <= 0) return { total: 0, breakdown: '' };

    const room = reservation.rooms.find((r: ReservationRoom) => r.selectedExtras?.some((e: SelectedExtra) => e.id === extra.id));
    const totalGuests = (room?.adults || 0) + (room?.children || 0);

    let itemTotal = 0;
    let breakdown = '';
    const { price: unitPrice, quantity, unit } = extra;
    
    switch(unit) {
        case 'one_time':
        case 'per_booking':
        case 'one_time_per_room':
            itemTotal = unitPrice * quantity;
            breakdown = `${currencySymbol}${unitPrice.toFixed(2)} x ${quantity}`;
            break;
        case 'per_night':
        case 'per_night_per_room':
            itemTotal = unitPrice * nights * quantity;
            breakdown = t('breakdowns.per_night', { price: `${currencySymbol}${unitPrice.toFixed(2)}`, nights: nights, quantity: quantity });
            break;
        case 'per_guest':
        case 'one_time_per_guest':
            itemTotal = unitPrice * totalGuests * quantity;
            breakdown = t('breakdowns.per_guest', { price: `${currencySymbol}${unitPrice.toFixed(2)}`, guests: totalGuests, quantity: quantity });
            break;
        case 'per_night_per_guest':
            itemTotal = unitPrice * nights * totalGuests * quantity;
            breakdown = t('breakdowns.per_night_per_guest', { price: `${currencySymbol}${unitPrice.toFixed(2)}`, nights: nights, guests: totalGuests, quantity: quantity });
            break;
        default:
            itemTotal = unitPrice * quantity;
            breakdown = `${currencySymbol}${unitPrice.toFixed(2)} x ${quantity}`;
    }
    return { total: itemTotal, breakdown };
  }, [reservation, currencySymbol, t]);

  useEffect(() => {
    if (isOpen && initialData?.id) {
      const resDocRef = doc(db, 'reservations', initialData.id);
      const unsub = onSnapshot(resDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setReservation({ 
              id: docSnap.id, 
              ...data, 
              startDate: (data.startDate as Timestamp).toDate(), 
              endDate: (data.endDate as Timestamp).toDate(),
              createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
              updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
              actualCheckInTime: data.actualCheckInTime ? (data.actualCheckInTime as Timestamp).toDate() : undefined,
              actualCheckOutTime: data.actualCheckOutTime ? (data.actualCheckOutTime as Timestamp).toDate() : undefined,
          } as Reservation);
        }
      });

      const invoiceId = initialData.id;
      const invoiceDocRef = doc(db, 'invoices', invoiceId);
      
      const fetchInvoiceAndPayments = async () => {
        try {
          const invoiceDocSnap = await getDoc(invoiceDocRef);
          if (invoiceDocSnap.exists()) {
            setFetchedInvoice({ id: invoiceDocSnap.id, ...invoiceDocSnap.data() } as Invoice);

            if (initialData.id) {
                const paymentsQuery = query(collection(db, `properties/${initialData.propertyId}/payments`), where('reservationId', '==', initialData.id));
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
           console.error("Failed to fetch invoice/payments:", error);
           setFetchedInvoice(null);
           setPayments([]);
        }
      };
      
      fetchInvoiceAndPayments();

      return () => unsub();
    } else {
      setReservation(initialData);
      setFetchedInvoice(null);
      setPayments([]);
    }
  }, [isOpen, initialData]);

  // Logic for package extras
  useEffect(() => {
    const fetchPackageExtras = async () => {
        if (!isOpen || !reservation?.packageInfo || !propertySettings?.id) {
            setIncludedServices([]);
            setIncludedMealPlans([]);
            return;
        }

        setIsLoadingExtras(true);
        const { includedServiceIds = [], includedMealPlanIds = [] } = reservation.packageInfo;
        
        try {
            const servicesPromise = includedServiceIds.length > 0
                ? getDocs(query(collection(db, 'services'), where('__name__', 'in', includedServiceIds)))
                : Promise.resolve({ docs: [] });

            const mealPlansPromise = includedMealPlanIds.length > 0
                ? getDocs(query(collection(db, 'mealPlans'), where('__name__', 'in', includedMealPlanIds)))
                : Promise.resolve({ docs: [] });

            const [servicesSnapshot, mealPlansSnapshot] = await Promise.all([servicesPromise, mealPlansPromise]);

            setIncludedServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
            setIncludedMealPlans(mealPlansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlan)));

        } catch (error) {
            console.error("Failed to fetch package extras:", error);
            toast({ title: t('toasts.error_title'), description: t('toasts.package_details_error'), variant: "destructive" });
        } finally {
            setIsLoadingExtras(false);
        }
    };
    
    fetchPackageExtras();
}, [isOpen, reservation, propertySettings?.id, t]);


  if (!reservation) return null;

  // Calculations
  const roomsTotal = reservation.roomsTotal || 0;
  const extrasTotal = reservation.extrasTotal || 0;
  const subtotal = reservation.subtotal || (roomsTotal + extrasTotal);
  const discountAmount = reservation.discountAmount || 0;
  const netAmount = reservation.netAmount || (subtotal - discountAmount);
  const taxAmount = reservation.taxAmount || 0;
  const grandTotal = reservation.totalPrice || (netAmount + taxAmount);
  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amountPaid, 0);
  const amountDue = grandTotal - totalPaid;

  const isCheckinDay = isToday(toDate(reservation.startDate) as Date);
  const isCheckoutDay = isToday(toDate(reservation.endDate) as Date);
  const nights = differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date);

  const notesParts = reservation.notes?.split('Special Requests:') || [];
  const internalNotes = notesParts[0]?.trim();
  const specialRequests = notesParts.length > 1 ? notesParts[1]?.trim() : '';

  // Handlers
  const handleDownload = async () => {
    if (!reservation || !propertySettings) {
        toast({ title: "Error", description: t('toasts.missing_data_error'), variant: "destructive" });
        return;
    }
    setIsProcessing(true);
    let currentInvoice = fetchedInvoice;
    // If invoice isn't in state yet, do a last-minute fetch
    if (!currentInvoice && reservation.id) {
        try {
            const invoiceDocRef = doc(db, 'invoices', reservation.id);
            const invoiceDocSnap = await getDoc(invoiceDocRef);
            if (invoiceDocSnap.exists()) {
                currentInvoice = { id: invoiceDocSnap.id, ...invoiceDocSnap.data() } as Invoice;
            }
        } catch (error) {
            console.error("On-demand invoice fetch failed:", error);
        }
    }
    
    if (!currentInvoice) {
        toast({ title: t('toasts.invoice_not_found_title'), description: t('toasts.invoice_not_found_description'), variant: "destructive" });
        setIsProcessing(false);
        return;
    }

    try {
        await i18n.loadNamespaces(['pdf_content', 'status/status_content']);
        const pdf = await generateInvoicePdf(currentInvoice, propertySettings, reservation, payments, t);
        pdf.save(`invoice-${currentInvoice.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.pdf_download_error'), variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (!reservation || !propertySettings || !fetchedInvoice) {
      toast({ title: t('toasts.error_title'), description: t('toasts.send_email_missing_data'), variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);

    let recipientEmail = '';
    const reservationData: Reservation | null = reservation;

    try {
        if (reservationData?.guestEmail) {
            recipientEmail = reservationData.guestEmail;
        } else if (reservation.guestId) {
            const guestDocSnap = await getDoc(doc(db, 'guests', reservation.guestId));
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
            invoice: fetchedInvoice,
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

  const handleCancelReservation = () => {
    if (!reservation) return;
    const totalPrice = reservation.totalPrice || 0;
    setRefundDialogInfo({
      reservationId: reservation.id,
      reservation,
      shouldRefund: true,
      refundAmount: totalPrice
    });
    setIsRefundDialogOpen(true);
  };

  const handleRefundDialogConfirm = async () => {
    if (!refundDialogInfo || !initialData?.propertyId) return;

    setIsProcessing(true);
    try {
      if (refundDialogInfo.shouldRefund && refundDialogInfo.refundAmount > 0) {
        const paymentsRef = collection(db, `properties/${initialData.propertyId}/payments`);
        const paymentQuery = query(paymentsRef, where("reservationId", "==", refundDialogInfo.reservationId), limit(1));
        const paymentSnap = await getDocs(paymentQuery);
        
        if (paymentSnap.docs.length > 0) {
          const payment = paymentSnap.docs[0].data();
          const functions = getFunctions(app, 'us-central1');
          const createRefund = httpsCallable(functions, 'createRefund');
          
          await createRefund({
            propertyId: initialData.propertyId,
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

      toast({
        title: "Reservation Canceled",
        description: refundDialogInfo.shouldRefund
          ? `Reservation canceled. Refund of ${currencySymbol}${refundDialogInfo.refundAmount.toFixed(2)} approved.`
          : "Reservation canceled. No refund issued.",
      });
      
      setIsRefundDialogOpen(false);
      setRefundDialogInfo(null);
      onClose();
    } catch (error: any) {
      console.error("Error canceling reservation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel reservation",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleOpenSendEmailDialog = () => {
    if (!reservation.guestEmail) {
      toast({
        title: t('toasts.no_email_title'),
        description: t('toasts.no_email_description'),
        variant: "destructive",
      });
      return;
    }
    setIsSendEmailModalOpen(true);
  };


  if (!reservation) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] p-0 gap-0 overflow-hidden bg-slate-50 border-none shadow-2xl rounded-2xl flex flex-col">
          {/* SCREEN READER TITLE */}
          <DialogTitle className="sr-only">
            {t('title', { id: reservation.reservationNumber || reservation.id })}
          </DialogTitle>

          {/* HEADER */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 border-b border-slate-700 flex flex-row justify-between items-start z-10">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">
                  {t('title', { id: reservation.reservationNumber || reservation.id })}
                </h2>
                <ReservationStatusBadge status={reservation.status} />
              </div>
              <p className="text-slate-300 text-sm flex items-center gap-2">
                <User size={16} /> {reservation.guestName}
              </p>
            </div>
            <DialogClose className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors focus:outline-none">
              <Icons.X size={24} />
            </DialogClose>
          </div>

          {/* CONTENT */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 space-y-8">
              
              {/* GUEST & STAY DETAILS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Guest Info */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User size={18} className="text-blue-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">{t('sections.guest.title')}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{t('sections.guest.full_name')}</p>
                      <p className="text-slate-800 font-medium">{reservation.guestName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{t('sections.guest.email')}</p>
                      {reservation.guestEmail ? (
                        <a href={`mailto:${reservation.guestEmail}`} className="text-blue-600 hover:text-blue-700 font-medium break-all">
                          {reservation.guestEmail}
                        </a>
                      ) : (
                        <p className="text-slate-400">N/A</p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{t('sections.guest.phone')}</p>
                      {reservation.guestPhone ? (
                        <a href={`tel:${reservation.guestPhone}`} className="text-blue-600 hover:text-blue-700 font-medium">
                          {reservation.guestPhone}
                        </a>
                      ) : (
                        <p className="text-slate-400">N/A</p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{t('sections.guest.country')}</p>
                      <p className="text-slate-800 font-medium">{reservation.guestCountry || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Passport/ID</p>
                      <p className="text-slate-800 font-medium">{reservation.guestPassportOrId || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Stay Details */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CalendarIcon size={18} className="text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">{t('sections.stay_details.title')}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Stay Dates</p>
                      <p className="text-slate-800 font-medium">
                        {format(toDate(reservation.startDate) as Date, "PPP", { locale })} - {format(toDate(reservation.endDate) as Date, "PPP", { locale })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Nights</p>
                      <p className="text-slate-800 font-medium">{nights} {nights === 1 ? 'night' : 'nights'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Guests</p>
                      <p className="text-slate-800 font-medium">
                        {Array.isArray(reservation.rooms) 
                          ? reservation.rooms.reduce((sum, room) => sum + (room.adults || 0), 0)
                          : 0}
                        {' Adult'}
                        {Array.isArray(reservation.rooms) && reservation.rooms.reduce((sum, room) => sum + (room.adults || 0), 0) !== 1 ? 's' : ''}
                        {' • '}
                        {Array.isArray(reservation.rooms) 
                          ? reservation.rooms.reduce((sum, room) => sum + (room.children || 0), 0)
                          : 0}
                        {' Child'}
                        {Array.isArray(reservation.rooms) && reservation.rooms.reduce((sum, room) => sum + (room.children || 0), 0) !== 1 ? 'ren' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Rooms</p>
                      <p className="text-slate-800 font-medium">{Array.isArray(reservation.rooms) ? reservation.rooms.length : 1} {(Array.isArray(reservation.rooms) && reservation.rooms.length !== 1) ? 'Rooms' : 'Room'}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CreditCard size={18} className="text-purple-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">{t('sections.pricing.payment_status')}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-2">Status</p>
                      <PaymentStatusBadge status={reservation.paymentStatus || 'Pending'} />
                    </div>
                    {reservation.paymentMethod && (
                      <div>
                        <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{t('sections.pricing.payment_method')}</p>
                        <p className="text-slate-800 font-medium px-3 py-2 bg-slate-100 rounded-lg inline-block">{reservation.paymentMethod}</p>
                      </div>
                    )}
                    {reservation.partialPaymentAmount > 0 && (
                      <div>
                        <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Partial Amount</p>
                        <p className="text-slate-800 font-medium">{currencySymbol}{reservation.partialPaymentAmount.toFixed(2)}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Booking Source</p>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                        <Globe size={14} className="text-slate-600" />
                        <p className="text-slate-700 font-medium">{reservation.source || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROOMS */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <BedDouble size={20} className="text-slate-600" />
                  {t('sections.booking.title')} ({Array.isArray(reservation.rooms) ? reservation.rooms.length : 0})
                </h3>
                <div className="space-y-3">
                  {Array.isArray(reservation.rooms) && reservation.rooms.map((room: ReservationRoom, index: number) => (
                    <RoomCard 
                      key={room.roomId || index} 
                      room={room} 
                      index={index}
                      currencySymbol={currencySymbol} 
                      nights={nights}
                      t={t}
                      calculateExtraItemTotal={calculateExtraItemTotal}
                    />
                  ))}
                </div>
              </div>

              {/* NOTES */}
              {(internalNotes || specialRequests) && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <ClipboardList size={18} className="text-amber-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">{t('sections.notes.title')}</h3>
                  </div>
                  <div className="space-y-4 text-sm">
                    {internalNotes && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">{t('sections.notes.internal_notes_title')}</h4>
                        <p className="text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap border-l-2 border-amber-400">{internalNotes}</p>
                      </div>
                    )}
                    {specialRequests && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">{t('sections.notes.special_requests_title')}</h4>
                        <p className="text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap border-l-2 border-blue-400">{specialRequests}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRICING SUMMARY */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 shadow-lg text-white">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Tag size={20} className="text-amber-400" />
                  {t('sections.pricing_summary.title')}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-300">{t('sections.pricing_summary.subtotal')}</span>
                    <span className="text-lg font-semibold">{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  
                  {taxAmount > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                      <span className="text-slate-300">Tax</span>
                      <span className="text-lg font-semibold text-amber-400">{currencySymbol}{taxAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                      <span className="text-slate-300 flex items-center gap-2">
                        <Zap size={16} className="text-green-400" />
                        <span>{t('sections.pricing_summary.discount')}</span>
                        <span className="text-green-400 font-semibold">({reservation.promotionApplied?.name || 'Discount'})</span>
                      </span>
                      <span className="text-lg font-semibold text-green-400">-{currencySymbol}{discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3">
                    <span className="text-xl font-bold">{t('sections.pricing_summary.grand_total')}</span>
                    <span className="text-3xl font-bold text-amber-400">{currencySymbol}{grandTotal.toFixed(2)}</span>
                  </div>

                  {totalPaid > 0 && (
                    <div className="flex justify-between items-center pt-3 mt-4 border-t border-slate-700">
                      <span className="text-slate-300">Total Paid</span>
                      <span className="text-lg font-semibold text-green-400">{currencySymbol}{totalPaid.toFixed(2)}</span>
                    </div>
                  )}

                  {amountDue > 0 && (
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-slate-300">Amount Due</span>
                      <span className="text-lg font-semibold text-red-400">{currencySymbol}{amountDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* TIMESTAMPS */}
              {(reservation.createdAt || reservation.updatedAt || reservation.actualCheckInTime || reservation.actualCheckOutTime) && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Icons.Clock size={16} />
                    {t('sections.timestamps.title')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {reservation.createdAt && (
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-medium">{t('sections.timestamps.created_at')}</span>
                        <span className="text-slate-800">{format(toDate(reservation.createdAt) as Date, "PPp", { locale })}</span>
                      </div>
                    )}
                    {reservation.updatedAt && (
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 font-medium">{t('sections.timestamps.last_updated')}</span>
                        <span className="text-slate-800">{format(toDate(reservation.updatedAt) as Date, "PPp", { locale })}</span>
                      </div>
                    )}
                    {reservation.actualCheckInTime && (
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <span className="text-green-700 font-medium">{t('sections.timestamps.actual_checkin')}</span>
                        <span className="text-green-900">{format(toDate(reservation.actualCheckInTime) as Date, "PPp", { locale })}</span>
                      </div>
                    )}
                    {reservation.actualCheckOutTime && (
                      <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="text-blue-700 font-medium">{t('sections.timestamps.actual_checkout')}</span>
                        <span className="text-blue-900">{format(toDate(reservation.actualCheckOutTime) as Date, "PPp", { locale })}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-white border-t border-slate-200 px-8 py-4 flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownload} 
                disabled={isProcessing || !fetchedInvoice}
              >
                <Icons.Download className="mr-2 h-4 w-4" />
                {t('buttons.download_invoice')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isProcessing}>
                    <Icons.Mail className="mr-2 h-4 w-4" /> 
                    {t('buttons.send_email')} 
                    <Icons.DropdownArrow className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleSendInvoiceEmail} disabled={!fetchedInvoice || !reservation.guestEmail}>
                    <Icons.FilePlus2 className="mr-2 h-4 w-4" /> {t('buttons.email_invoice')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenSendEmailDialog} disabled={!reservation.guestEmail}>
                    <Icons.Mail className="mr-2 h-4 w-4" /> {t('buttons.other_templates')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap gap-2">
              {onCheckIn && canManage && isCheckinDay && reservation.status === 'Confirmed' && !reservation.actualCheckInTime && (
                <Button 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => onCheckIn(reservation.id)}
                >
                  <Icons.LogIn className="mr-2 h-4 w-4" /> {t('buttons.check_in')}
                </Button>
              )}
              {onCheckOut && canManage && isCheckoutDay && reservation.status === 'Checked-in' && !reservation.actualCheckOutTime && (
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => onCheckOut(reservation)}
                >
                  <Icons.LogOut className="mr-2 h-4 w-4" /> {t('buttons.check_out')}
                </Button>
              )}
              {canManage && onEdit && (
                <Button 
                  size="sm"
                  variant="outline" 
                  onClick={() => { if (onEdit) { onEdit(reservation); } onClose(); }}
                >
                  <Icons.Edit className="mr-2 h-4 w-4" /> {t('buttons.edit')}
                </Button>
              )}
              {canManage && reservation.status !== 'Canceled' && reservation.status !== 'Completed' && (
                <Button 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelReservation}
                >
                  <Icons.X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              )}
              <DialogClose asChild>
                <Button size="sm" variant="secondary">{t('buttons.close')}</Button>
              </DialogClose>
            </div>
          </div>
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
                <span className="text-lg font-bold">{currencySymbol}{refundDialogInfo?.reservation.totalPrice?.toFixed(2)}</span>
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
                    <span className="text-sm font-medium">{currencySymbol}</span>
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
                    Max: {currencySymbol}{refundDialogInfo?.reservation.totalPrice?.toFixed(2)}
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
    </>
  );
}
