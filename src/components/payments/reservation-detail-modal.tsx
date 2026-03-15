

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
import ReservationStatusBadge from "./reservation-status-badge";
import type { Reservation, SelectedExtra } from '@/components/calendar/types';
import { format, parseISO, differenceInDays, isToday } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { enUS, fr } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import type { Property } from '@/types/property';
import { generateInvoicePdf } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, type Timestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import type { Invoice } from '@/app/(app)/payments/page';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import SendEmailDialog from './send-email-dialog';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import { useTranslation } from 'react-i18next';

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  propertySettings: Property | null;
  onEdit?: (reservation: Reservation) => void;
  onCheckIn?: (reservationId: string) => void;
  onCheckOut?: (reservation: Reservation) => void;
  canManage?: boolean;
}

export default function ReservationDetailModal({ isOpen, onClose, reservation, propertySettings, onEdit, canManage, onCheckIn, onCheckOut }: ReservationDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchedInvoice, setFetchedInvoice] = useState<Invoice | null>(null);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const { t, i18n } = useTranslation('pages/dashboard/reservation-details-modal-content');
  const { t: tStatus } = useTranslation('status/status_content');
  const locale = i18n.language === 'fr' ? fr : enUS;

  const [includedServices, setIncludedServices] = useState<Service[]>([]);
  const [includedMealPlans, setIncludedMealPlans] = useState<MealPlan[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);

  useEffect(() => {
    if (isOpen && reservation?.id) {
      const invoiceId = reservation.id;
      const invoiceDocRef = doc(db, 'invoices', invoiceId);
      
      const fetchInvoice = async () => {
        try {
          const invoiceDocSnap = await getDoc(invoiceDocRef);
          if (invoiceDocSnap.exists()) {
            setFetchedInvoice({ id: invoiceDocSnap.id, ...invoiceDocSnap.data() } as Invoice);
          } else {
            setFetchedInvoice(null);
          }
        } catch (error) {
           console.error("Failed to fetch invoice for reservation:", error);
           setFetchedInvoice(null);
        }
      };
      
      fetchInvoice();
    } else {
      setFetchedInvoice(null);
    }
  }, [isOpen, reservation]);

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

  const currencySymbol = propertySettings?.currency || '$';
  
  const calculateExtraItemTotal = useCallback((extra: SelectedExtra) => {
    const nights = differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date);
    if (nights <= 0) return { total: 0, breakdown: '' };

    const totalGuests = (reservation.adults || 0) + (reservation.children || 0);
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
  }, [reservation.endDate, reservation.startDate, reservation.adults, reservation.children, currencySymbol, t]);

  const extrasTotal = reservation.selectedExtras?.reduce((total, extra) => {
    return total + calculateExtraItemTotal(extra).total;
  }, 0) || 0;
  
  const taxSettings = propertySettings?.taxSettings;
  const taxIsEnabled = taxSettings?.enabled ?? false;
  const taxRate = taxIsEnabled ? taxSettings.rate || 0 : 0;
  
  const nights = differenceInDays(toDate(reservation.endDate) as Date, toDate(reservation.startDate) as Date);
  
  // Calculate pricing based on whether it's a package or not
  let grandTotal = reservation.totalPrice || 0;
  let stayTotal = 0;
  let taxAmount = 0;
  let roomPricePerNight = 0;

  if (reservation.packageInfo) {
      stayTotal = grandTotal; // For packages, the total price is considered the "stay total"
  } else {
      stayTotal = (reservation.totalPrice || 0) - extrasTotal;
      roomPricePerNight = nights > 0 ? stayTotal / nights : stayTotal;
      const subtotalForTax = stayTotal + extrasTotal;
      taxAmount = taxIsEnabled && taxRate > 0 ? subtotalForTax * (taxRate / 100) : 0;
      grandTotal = subtotalForTax + taxAmount;
  }

  const isCheckinDay = isToday(toDate(reservation.startDate) as Date);
  const isCheckoutDay = isToday(toDate(reservation.endDate) as Date);
  
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
        const pdf = await generateInvoicePdf(currentInvoice, propertySettings, reservation);
        pdf.save(`invoice-${currentInvoice.invoiceNumber}.pdf`);
        toast({ title: t('toasts.success_title'), description: t('toasts.pdf_download_success') });
    } catch (error) {
        console.error("Error during PDF download:", error);
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
    let reservationData: Reservation | null = reservation;

    try {
        if (!reservationData && reservation.id) {
            const resDocSnap = await getDoc(doc(db, 'reservations', reservation.id));
            if (resDocSnap.exists()) {
                const data = resDocSnap.data();
                reservationData = { ...data, id: resDocSnap.id, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation;
            }
        }

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
      
        const pdf = await generateInvoicePdf(fetchedInvoice, propertySettings, reservationData);
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


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('title', { id: reservation.reservationNumber || reservation.id })}</DialogTitle>
            <DialogDescription>
              {t('description', { name: reservation.guestName })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto pr-2">
            {/* Guest Information */}
            <section className="px-3">
              <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.guest.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between"><span className="font-medium">{t('sections.guest.full_name')}:</span><span className="text-muted-foreground truncate" title={reservation.guestName || "N/A"}>{reservation.guestName || "N/A"}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.guest.email')}:</span><span className="text-muted-foreground truncate" title={reservation.guestEmail || "N/A"}>{reservation.guestEmail || "N/A"}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.guest.phone')}:</span><span className="text-muted-foreground">{reservation.guestPhone || "N/A"}</span></div>
              </div>
            </section>

            <Separator />

            {/* Booking Details */}
            <section className="px-3">
              <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.booking.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                 {reservation.packageInfo && (
                  <div className="md:col-span-2 flex justify-between"><span className="font-medium text-primary">{t('sections.booking.package_booked')}:</span><span className="text-muted-foreground font-semibold">{reservation.packageInfo.name}</span></div>
                )}
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.room_type')}:</span><span className="text-muted-foreground">{reservation.roomTypeName || reservation.roomTypeId}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.room')}:</span><span className="text-muted-foreground">{reservation.roomName || reservation.roomId}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.rate_plan')}:</span><span className="text-muted-foreground">{reservation.ratePlanName || "N/A"}</span></div>
                {reservation.source && <div className="flex justify-between"><span className="font-medium">{t('sections.booking.source')}:</span><span className="text-muted-foreground">{reservation.source}</span></div>}
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.check_in')}:</span><span className="text-muted-foreground">{format(reservation.startDate, "PP", { locale })}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.check_out')}:</span><span className="text-muted-foreground">{format(reservation.endDate, "PP", { locale })}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.adults')}:</span><span className="text-muted-foreground">{reservation.adults ?? "N/A"}</span></div>
                <div className="flex justify-between"><span className="font-medium">{t('sections.booking.children')}:</span><span className="text-muted-foreground">{reservation.children ?? "N/A"}</span></div>
              </div>
            </section>

            <Separator />

            {/* Status & Payment */}
            <section className="px-3">
              <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.pricing.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm items-center">
                <div className="flex justify-between items-center"><span className="font-medium">{t('sections.pricing.reservation_status')}:</span><ReservationStatusBadge status={reservation.status} /></div>
                <div className="flex justify-between items-center"><span className="font-medium">{t('sections.pricing.payment_status')}:</span><p className="text-muted-foreground capitalize">{tStatus(`payment.${(reservation.paymentStatus || 'Pending').toLowerCase()}`)}</p></div>
              </div>
              
              <Separator className="my-3" />
              
              <div className="space-y-1 text-sm max-w-sm ml-auto">
                <div className="flex justify-between">
                  <span className="flex-1">{t('sections.pricing.stay_total')}</span>
                  {!reservation.packageInfo && <span className="text-muted-foreground text-xs text-right shrink-0 mx-2">({t('sections.pricing.nights_breakdown', { price: `${currencySymbol}${roomPricePerNight.toFixed(2)}`, nights: nights })})</span>}
                  <span className="font-medium">{currencySymbol}{stayTotal.toFixed(2)}</span>
                </div>

                {extrasTotal > 0 && !reservation.packageInfo && (
                    <div className="flex justify-between">
                        <span className="flex-1">{t('sections.pricing.extras_total')}:</span>
                        <span className="font-medium">{currencySymbol}{extrasTotal.toFixed(2)}</span>
                    </div>
                )}
                
                {(taxIsEnabled && taxAmount > 0) && (
                    <div className="flex justify-between">
                        <span>{t('sections.pricing.tax', { name: taxSettings?.name || 'Tax', rate: taxRate })}:</span>
                        <span>{currencySymbol}{taxAmount.toFixed(2)}</span>
                    </div>
                )}
                <Separator className="my-1.5"/>
                <div className="flex justify-between font-bold text-base"><span>{t('sections.pricing.grand_total')}:</span><span>{currencySymbol}{grandTotal.toFixed(2)}</span></div>
              </div>
            </section>
            
            {reservation.packageInfo && (
              <>
                <Separator />
                <section className="px-3">
                    <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.package.title')}</h3>
                    {isLoadingExtras ? (
                        <div className="flex items-center justify-center h-16"><Icons.Spinner className="h-5 w-5 animate-spin" /></div>
                    ) : (
                        <div className="space-y-2">
                            {[...includedServices, ...includedMealPlans].map(item => (
                                <div key={item.id} className="flex justify-between items-start text-sm">
                                    <p className="font-medium text-foreground">{item.name}</p>
                                    <Badge variant="outline">{t('sections.package.included')}</Badge>
                                </div>
                            ))}
                            {includedServices.length === 0 && includedMealPlans.length === 0 && (
                                <p className="text-sm text-muted-foreground">{t('sections.package.no_extras')}</p>
                            )}
                        </div>
                    )}
                </section>
              </>
            )}

            {reservation.selectedExtras && reservation.selectedExtras.length > 0 && !reservation.packageInfo && (
              <>
                <Separator />
                <section className="px-3">
                  <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.extras.title')}</h3>
                  <div className="space-y-2">
                    {reservation.selectedExtras.map(extra => {
                      const { total, breakdown } = calculateExtraItemTotal(extra);
                      return (
                        <div key={extra.id} className="flex justify-between items-start text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">{extra.name} x {extra.quantity}</p>
                            {breakdown && <p className="text-xs">({breakdown})</p>}
                          </div>
                          <Badge variant="outline">{`${currencySymbol}${total.toFixed(2)}`}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            )}
            
            {(reservation.createdAt || reservation.updatedAt || reservation.actualCheckInTime || reservation.actualCheckOutTime) && <Separator />}

            {(reservation.createdAt || reservation.updatedAt || reservation.actualCheckInTime || reservation.actualCheckOutTime) && (
              <section className="px-3">
                  <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.timestamps.title')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {reservation.createdAt && <div className="flex justify-between"><span className="font-medium">{t('sections.timestamps.created_at')}:</span><span className="text-muted-foreground">{format(toDate(reservation.createdAt) as Date, "PPp", { locale })}</span></div>}
                      {reservation.updatedAt && <div className="flex justify-between"><span className="font-medium">{t('sections.timestamps.last_updated')}:</span><span className="text-muted-foreground">{format(toDate(reservation.updatedAt) as Date, "PPp", { locale })}</span></div>}
                      {reservation.actualCheckInTime && <div className="flex justify-between"><span className="font-medium">{t('sections.timestamps.actual_checkin')}:</span><span className="text-muted-foreground">{format(toDate(reservation.actualCheckInTime) as Date, "PPp", { locale })}</span></div>}
                      {reservation.actualCheckOutTime && <div className="flex justify-between"><span className="font-medium">{t('sections.timestamps.actual_checkout')}:</span><span className="text-muted-foreground">{format(toDate(reservation.actualCheckOutTime) as Date, "PPp", { locale })}</span></div>}
                  </div>
              </section>
            )}

            {reservation.notes && (
              <>
                <Separator />
                <section className="px-3">
                  <h3 className="text-md font-semibold text-foreground mb-2">{t('sections.notes.title')}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reservation.notes}</p>
                </section>
              </>
            )}
          </div>

          <DialogFooter className="flex-wrap justify-between sm:justify-between items-center gap-2 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleDownload} disabled={isProcessing || !fetchedInvoice}>
                      {isProcessing ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/> : <Icons.Download className="mr-2 h-4 w-4" />}
                  {t('buttons.download_invoice')}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isProcessing}>
                        <Icons.Mail className="mr-2 h-4 w-4" /> {t('buttons.send_email')} <Icons.DropdownArrow className="ml-2 h-4 w-4" />
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
                      <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onCheckIn(reservation.id)}>
                          <Icons.LogIn className="mr-2 h-4 w-4" /> {t('buttons.check_in')}
                      </Button>
                  )}
                  {onCheckOut && canManage && isCheckoutDay && reservation.status === 'Checked-in' && !reservation.actualCheckOutTime && (
                       <Button variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={() => onCheckOut(reservation)}>
                          <Icons.LogOut className="mr-2 h-4 w-4" /> {t('buttons.check_out')}
                      </Button>
                  )}
                  {canManage && onEdit && (
                      <Button type="button" variant="outline" onClick={() => onEdit(reservation)}>
                          <Icons.Edit className="mr-2 h-4 w-4" /> {t('buttons.edit')}
                      </Button>
                  )}
                  <DialogClose asChild>
                      <Button type="button" variant="secondary">{t('buttons.close')}</Button>
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
