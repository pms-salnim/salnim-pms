
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import type { EmailTemplate } from '@/types/emailTemplate';
import { dynamicVariables } from '@/types/emailTemplate';
import { ScrollArea } from '../ui/scroll-area';
import { Icons } from '../icons';
import { useAuth } from '@/contexts/auth-context';
import type { Property } from '@/types/property';
import { db } from '@/lib/firebase';
import { query, collection, where, orderBy, limit, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Reservation } from '@/types/calendar/types';
import type { Invoice } from '@/app/(app)/payments/page';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';


interface EmailTemplateEditorProps {
  initialData: EmailTemplate;
  onSave: (data: Omit<EmailTemplate, 'id' | 'propertyId' | 'lastEditedBy' | 'lastEditedAt'>) => Promise<void>;
}

const generatePreviewHtml = (bodyContent: string, propertyData: Property | null): string => {
    const primaryColor = propertyData?.invoiceCustomization?.primaryColor || '#003166';
    const logoUrl = propertyData?.bookingPageSettings?.logoUrl || '';
    const propertyName = propertyData?.name || 'Your Property';
    const propertyAddress = propertyData?.address || '';
    const currentYear = new Date().getFullYear();
    const formattedBody = bodyContent.replace(/\n/g, '<br />');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${propertyName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 20px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <!-- Header -->
              <tr>
                <td align="center" style="background-color: ${primaryColor}; padding: 20px;">
                  ${logoUrl 
                    ? `<img src="${logoUrl}" alt="${propertyName} Logo" style="max-width: 150px; max-height: 70px; border: 0;">`
                    : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${propertyName}</h1>`
                  }
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                  ${formattedBody}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0;">${propertyName}</p>
                  ${propertyAddress ? `<p style="margin: 5px 0 0 0;">${propertyAddress}</p>` : ''}
                  <p style="margin: 10px 0 0 0;">&copy; ${currentYear} ${propertyName}. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
};


export default function EmailTemplateEditor({ initialData, onSave }: EmailTemplateEditorProps) {
  const { property } = useAuth();
  const { t } = useTranslation('pages/settings/email-templates/content');
  const [subject, setSubject] = useState(initialData.subject);
  const [body, setBody] = useState(initialData.body);
  const [status, setStatus] = useState(initialData.status);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // State for preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSave(status, true); // auto-save
    }, 10000); // Auto-save every 10 seconds

    return () => clearTimeout(timer);
  }, [subject, body, status]);

  const handleSave = async (newStatus: 'draft' | 'live' | 'disabled', isAutoSave = false) => {
    if (isAutoSave) {
        if (subject === initialData.subject && body === initialData.body && newStatus === initialData.status) return; // Don't save if nothing changed
    } else {
        setIsSaving(true);
    }

    try {
      await onSave({
        type: initialData.type,
        subject,
        body,
        status: newStatus,
      });
      if (!isAutoSave) {
        // This toast is handled by the parent component after successful save.
      } else {
        toast({ title: t('toasts.success_autosave') });
      }
    } catch (error) {
      if (!isAutoSave) {
        toast({ title: t('toasts.error_save'), variant: "destructive" });
      }
    } finally {
      if (!isAutoSave) {
          setIsSaving(false);
      }
    }
  };

  const handleInsertVariable = (variable: string) => {
    setBody(prev => `${prev}{{${variable}}}`);
  };

  const handlePreview = async () => {
    setIsGeneratingPreview(true);

    let sampleReservation: Reservation | null = null;
    let sampleInvoice: Invoice | null = null;

    try {
        if (property?.id) {
            // Fetch latest reservation
            const resQuery = query(collection(db, "reservations"), where("propertyId", "==", property.id), orderBy("createdAt", "desc"), limit(1));
            const resSnap = await getDocs(resQuery);
            if (!resSnap.empty) {
                const data = resSnap.docs[0].data();
                sampleReservation = { ...data, id: resSnap.docs[0].id, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation;
            }

            // Fetch latest invoice
            const invQuery = query(collection(db, "invoices"), where("propertyId", "==", property.id), orderBy("createdAt", "desc"), limit(1));
            const invSnap = await getDocs(invQuery);
            if (!invSnap.empty) {
                sampleInvoice = { id: invSnap.docs[0].id, ...invSnap.data() } as Invoice;
                if (sampleInvoice.reservationId && !sampleReservation) {
                    const linkedResDoc = await getDoc(doc(db, "reservations", sampleInvoice.reservationId));
                    if (linkedResDoc.exists()){
                        const data = linkedResDoc.data();
                        sampleReservation = { ...data, id: linkedResDoc.id, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation;
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch sample data for preview:", e);
        toast({ title: t('toasts.error_preview'), description: t('toasts.preview_placeholder_note'), variant: "default" });
    }

    let previewBody = body;
    let previewSubject = subject;

    const currencySymbol = property?.currency || "$";
    const findMock = (key: string) => dynamicVariables.find(v => v.variable === key)?.sampleValue || `{{${key}}}`;

    // Create a dictionary of all possible replacements
    const replacements = {
        guest_name: sampleReservation?.guestName || sampleInvoice?.guestOrCompany || findMock('guest_name'),
        reservation_code: sampleReservation?.id || findMock('reservation_code'),
        reservation_number: sampleReservation?.reservationNumber || findMock('reservation_number'),
        check_in_date: sampleReservation ? format(sampleReservation.startDate, "PP") : (sampleInvoice?.checkInDate ? format(parseISO(sampleInvoice.checkInDate), "PP") : findMock('check_in_date')),
        check_out_date: sampleReservation ? format(sampleReservation.endDate, "PP") : (sampleInvoice?.checkOutDate ? format(parseISO(sampleInvoice.checkOutDate), "PP") : findMock('check_out_date')),
        room_type: sampleReservation?.roomTypeName || sampleInvoice?.roomTypeName || findMock('room_type'),
        room_number: sampleReservation?.roomName || findMock('room_number'),
        number_of_nights: sampleReservation ? differenceInDays(sampleReservation.endDate, sampleReservation.startDate).toString() : (sampleInvoice?.numberOfNights?.toString() || findMock('number_of_nights')),
        number_of_guests: sampleReservation ? (Number(sampleReservation.adults || 0) + Number(sampleReservation.children || 0)).toString() : (sampleInvoice?.numberOfGuests?.toString() || findMock('number_of_guests')),
        price_per_night: sampleReservation ? `${currencySymbol}${((sampleReservation.totalPrice || 0) / (differenceInDays(sampleReservation.endDate, sampleReservation.startDate) || 1)).toFixed(2)}` : (sampleInvoice ? `${currencySymbol}${(sampleInvoice.pricePerNight || 0).toFixed(2)}` : findMock('price_per_night')),
        total_price: `${currencySymbol}${(sampleInvoice?.amount || sampleReservation?.totalPrice || 0).toFixed(2)}`,
        total_taxes: `${currencySymbol}${(sampleInvoice?.taxAmount || 0).toFixed(2)}`,
        
        property_name: property?.name || findMock('property_name'),
        property_address: property?.address || findMock('property_address'),
        property_phone: property?.phone || findMock('property_phone'),
        property_email: property?.email || findMock('property_email'),

        invoice_number: sampleInvoice?.invoiceNumber || findMock('invoice_number'),
        invoice_amount: `${currencySymbol}${(sampleInvoice?.amount || 0).toFixed(2)}`,
        invoice_due_date: sampleInvoice?.dueDate ? format(parseISO(sampleInvoice.dueDate), 'PP') : findMock('invoice_due_date'),
    };

    // Replace all standard variables
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      previewBody = previewBody.replace(regex, String(value));
      previewSubject = previewSubject.replace(regex, String(value));
    }

    // Handle complex extras tag separately
    let extrasText = "";
    if (sampleReservation?.selectedExtras && sampleReservation.selectedExtras.length > 0) {
        extrasText += "\n\n--- Extras ---";
        const nights = differenceInDays(sampleReservation.endDate, sampleReservation.startDate);
        const guests = (sampleReservation.adults || 0) + (sampleReservation.children || 0);
        sampleReservation.selectedExtras.forEach(extra => {
            const { price: unitPrice, quantity, unit, name } = extra;
            let itemTotal = 0;
            switch(unit) {
                case 'one_time': case 'per_booking': case 'one_time_per_room':
                    itemTotal = unitPrice * quantity; break;
                case 'per_night': case 'per_night_per_room':
                    itemTotal = unitPrice * nights * quantity; break;
                case 'per_guest': case 'one_time_per_guest':
                    itemTotal = unitPrice * guests * quantity; break;
                case 'per_night_per_guest':
                    itemTotal = unitPrice * nights * guests * quantity; break;
                default:
                    itemTotal = unitPrice * quantity;
            }
            extrasText += `\n- ${name} (x${quantity}): ${currencySymbol}${itemTotal.toFixed(2)}`;
        });
    } else if (dynamicVariables.find(v => v.variable === 'extras')) {
        extrasText = findMock('extras');
    }
    previewBody = previewBody.replace(/{{extras}}/g, extrasText);

    // --- Start: Handle Price Breakdown ---
    if (previewBody.includes("{{price_breakdown}}")) {
      let breakdownText = "";
      if (sampleReservation) {
        const breakdownData = {
          roomsTotal: sampleReservation.roomsTotal,
          extrasTotal: sampleReservation.extrasTotal,
          subtotal: sampleReservation.subtotal,
          discountAmount: sampleReservation.discountAmount,
          netAmount: sampleReservation.netAmount,
          taxAmount: sampleReservation.taxAmount,
          total_price: sampleReservation.totalPrice,
        };
        const currency = property?.currency || '$';

        if (breakdownData.roomsTotal !== undefined) breakdownText += `\nRooms Total: ${currency}${Number(breakdownData.roomsTotal).toFixed(2)}`;
        if (breakdownData.extrasTotal !== undefined && Number(breakdownData.extrasTotal) > 0) breakdownText += `\nExtras Total: ${currency}${Number(breakdownData.extrasTotal).toFixed(2)}`;
        if (breakdownData.subtotal !== undefined) breakdownText += `\nSubtotal: ${currency}${Number(breakdownData.subtotal).toFixed(2)}`;
        if (breakdownData.discountAmount !== undefined && Number(breakdownData.discountAmount) > 0) breakdownText += `\nDiscount: -${currency}${Number(breakdownData.discountAmount).toFixed(2)}`;
        if (breakdownData.netAmount !== undefined) breakdownText += `\nNet Amount: ${currency}${Number(breakdownData.netAmount).toFixed(2)}`;
        if (breakdownData.taxAmount !== undefined && Number(breakdownData.taxAmount) > 0) breakdownText += `\nTaxes: ${currency}${Number(breakdownData.taxAmount).toFixed(2)}`;
        if (breakdownData.total_price !== undefined) breakdownText += `\n\nGrand Total: ${currency}${Number(breakdownData.total_price).toFixed(2)}`;
      } else {
        breakdownText = t('toasts.price_breakdown_placeholder');
      }
      previewBody = previewBody.replace("{{price_breakdown}}", breakdownText.trim());
    }
    // --- End: Handle Price Breakdown ---


    const finalHtml = generatePreviewHtml(previewBody, property);
    setPreviewHtml(finalHtml);
    setIsGeneratingPreview(false);
    setIsPreviewOpen(true);
  };

  return (
    <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden pt-4">
          {/* Editor Panel */}
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
             <div className="flex items-center space-x-2">
                <Switch 
                    id="template-status" 
                    checked={status === 'live'}
                    onCheckedChange={(checked) => {
                        const newStatus = checked ? 'live' : 'disabled';
                        setStatus(newStatus);
                    }}
                />
                <Label htmlFor="template-status" className="font-semibold">
                    {status === 'live' ? t('editor.status_enabled') : t('editor.status_disabled')}
                </Label>
            </div>
            <Separator />
            <div className="space-y-1">
              <Label htmlFor="emailSubject">{t('editor.subject_label')}</Label>
              <Input id="emailSubject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1 flex flex-col">
              <Label htmlFor="emailBody">{t('editor.body_label')}</Label>
              <Textarea id="emailBody" value={body} onChange={e => setBody(e.target.value)} className="flex-1 resize-none" />
            </div>
            <DialogFooter className="border-t pt-4">
                <Button type="button" variant="secondary" onClick={handlePreview} disabled={isGeneratingPreview}>
                    {isGeneratingPreview && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                    {t('editor.preview_button')}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleSave(status)} disabled={isSaving}>
                    {isSaving && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                    {t('editor.save_button')}
                </Button>
            </DialogFooter>
          </div>
          
          {/* Variables Panel */}
          <div className="lg:col-span-1 border-l pl-6 flex flex-col gap-4 overflow-hidden">
              <div className="space-y-2 flex-1 flex flex-col">
                <h4 className="font-semibold">{t('editor.variables_title')}</h4>
                <p className="text-xs text-muted-foreground">{t('editor.variables_description')}</p>
                <ScrollArea className="h-96 rounded-md border p-2">
                  <div className="flex flex-wrap gap-2">
                      {dynamicVariables.map(v => (
                          <Button key={v.variable} type="button" size="sm" variant="outline" onClick={() => handleInsertVariable(v.variable)}>
                            {`{{${v.variable}}}`}
                          </Button>
                      ))}
                  </div>
                </ScrollArea>
              </div>
          </div>
        </div>
        
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
                 <DialogHeader>
                    <DialogTitle>{t('preview_modal.title')}</DialogTitle>
                    <DialogDescription>
                        {t('preview_modal.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow w-full mt-2 border rounded-md">
                   <iframe
                       srcDoc={previewHtml}
                       title="Email Preview"
                       className="w-full h-full border-0"
                   />
                </div>
                 <DialogFooter className="pt-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">{t('buttons.close')}</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}
