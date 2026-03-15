
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, Payment } from '@/app/(app)/payments/page'; // Adjust the import path as necessary
import { format, parseISO, differenceInDays } from 'date-fns';
import type { Property } from '@/types/property';
import type { Reservation, SelectedExtra, ReservationRoom, Promotion } from '@/components/calendar/types';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import i18n, { type TFunction } from 'i18next';


export async function generateInvoicePdf(
  invoice: Invoice,
  property: Property | null,
  reservation: Reservation | null,
  payments?: Payment[],
  t?: TFunction
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;

  const invoiceSettings = property?.invoiceCustomization || {};
  const currencySymbol = property?.currency || '$';
  const primaryColor = invoiceSettings.primaryColor || '#003166'; // Fallback color
  
  const getLabel = (key: string, options?: any): string => {
    if (t) {
        const translation = t(key, { ns: ['pdf_content', 'status/status_content'], ...options });
        return translation === key ? key.split(':').pop() || key : translation;
    }
    // Fallback if t is not provided (for cloud functions)
    return i18n.t(key, { ns: ['pdf_content', 'status/status_content'], ...options });
  };


  // --- Document Properties ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // --- Header ---
  let yOffset = 20;

  const logoUrl = invoiceSettings.logoUrl;
  let logoDataUri: string | null = null;

  if (logoUrl) {
    if (logoUrl.startsWith('data:image')) {
      logoDataUri = logoUrl;
    } else if (logoUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const functions = getFunctions(app, 'europe-west1');
        const fetchImageProxy = httpsCallable(functions, 'fetchImageProxy');
        const result: any = await fetchImageProxy({ url: logoUrl });
        if (result.data.dataUri) {
          logoDataUri = result.data.dataUri;
        } else {
          throw new Error("No data URI in proxy response");
        }
      } catch (error) {
        console.error("Failed to fetch logo for PDF:", error);
        toast({ title: "Logo Error", description: "Could not fetch the property logo for the PDF.", variant: "destructive" });
      }
    }
  }

  if (logoDataUri) {
      try {
        const logoSize = invoiceSettings.logoSize || 25; // Default height of 25px
        const imgProps = doc.getImageProperties(logoDataUri);
        const logoWidth = (imgProps.width * logoSize) / imgProps.height;
        doc.addImage(logoDataUri, imgProps.fileType, 15, 15, logoWidth, logoSize);
      } catch(e) {
          console.error("jsPDF addImage Error:", e);
          toast({ title: "PDF Render Error", description: "Failed to add logo to the PDF. The image format might not be supported.", variant: "destructive" });
      }
  }


  // Invoice Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor);
  doc.text(getLabel('invoice_title'), pageWidth - 15, yOffset, { align: 'right' });
  
  // Property Info (if included)
  yOffset = 48; // Reset yOffset for details section
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'normal');
  if (invoiceSettings.includePropertyAddress) {
      doc.setFont('helvetica', 'bold');
      doc.text(property?.name || 'Your Property', 20, yOffset);
      yOffset += 5;
      doc.setFont('helvetica', 'normal');
      doc.text(property?.address || 'Property Address', 20, yOffset);
      yOffset += 5;
      const contactInfo = [property?.email, property?.phone].filter(Boolean).join(' | ');
      doc.text(contactInfo, 20, yOffset);
  }

  // Invoice Details
  yOffset = 48; 
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${getLabel('invoice_number_label')}:`, 140, yOffset);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, pageWidth - 20, yOffset, { align: 'right' });
  
  yOffset += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`${getLabel('date_issued_label')}:`, 140, yOffset);
  doc.setFont('helvetica', 'bold');
  doc.text(`${format(parseISO(invoice.dateIssued), 'PP')}`, pageWidth - 20, yOffset, { align: 'right' });
  
  yOffset += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`${getLabel('due_date_label')}:`, 140, yOffset);
  doc.setFont('helvetica', 'bold');
  doc.text(`${format(parseISO(invoice.dueDate), 'PP')}`, pageWidth - 20, yOffset, { align: 'right' });

  // --- Bill To ---
  yOffset = 80;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${getLabel('bill_to_label')}:`, 20, yOffset);
  yOffset += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const guestInfo = [
    invoice.guestOrCompany,
    reservation?.guestEmail || invoice.guestEmail,
    reservation?.guestPhone || invoice.guestPhone,
  ].filter(Boolean) as string[];
  doc.text(guestInfo, 20, yOffset);
  yOffset += guestInfo.length * 5;

  if (invoice.reservationId) {
    yOffset = Math.max(yOffset, 87); // ensure yOffset doesn't go backwards
    doc.text(`${getLabel('reservation_id_label')}: ${reservation?.reservationNumber || invoice.reservationId}`, 20, yOffset);
    yOffset += 5;
  }

  // --- Header Note ---
  yOffset = Math.max(yOffset + 10, 105); 
  if(invoiceSettings.headerNotes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(invoiceSettings.headerNotes, pageWidth/2, yOffset, { align: 'center'});
    yOffset += 10;
  }


  // --- Line Items Table ---
  const tableHeaders = [[
    getLabel('description_label'),
    getLabel('qty_label'),
    getLabel('unit_price_label'),
    getLabel('total_label'),
  ]];
  const tableData = (invoice.lineItems || []).map((item: any) => [
    item.description,
    item.quantity.toString(),
    `${currencySymbol}${item.unitPrice.toFixed(2)}`,
    `${currencySymbol}${item.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yOffset,
    head: tableHeaders,
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
    },
    didDrawPage: (data) => {
        yOffset = data.cursor?.y || yOffset;
    }
  });

  // --- Totals Section ---
  let finalContentY = (doc as any).lastAutoTable.finalY || yOffset;
  const totalsLabelX = 130;
  const totalsValueX = pageWidth - 20;
  yOffset = finalContentY + 10;
  
  if (yOffset > pageHeight - 80) { // Check if there's enough space for totals block
      doc.addPage();
      yOffset = margin;
      finalContentY = margin;
  }
  
  doc.setFontSize(10);
  doc.setTextColor(40);
  
  const subtotal = invoice.subtotal;
  const discountAmount = invoice.discountAmount || 0;
  const netAmount = subtotal - discountAmount;
  const taxAmount = invoice.taxAmount || 0;
  const grandTotal = netAmount + taxAmount;
  
  const totalPaid = (payments || []).filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amountPaid, 0);
  const amountDue = grandTotal - totalPaid;

  // Render Subtotal, Discount, Net Amount, Tax
  doc.setFont('helvetica', 'normal');
  doc.text(`${getLabel('subtotal_label')}:`, totalsLabelX, yOffset);
  doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  yOffset += 7;
  
  if (discountAmount > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(0, 150, 0);
    const promotion = reservation?.promotionApplied as unknown as Promotion; 
    let discountLabelText = getLabel('discount_label');
    if (promotion) {
        if (promotion.discountType === 'percentage') {
            discountLabelText = `${getLabel('discount_label')} (${promotion.discountValue}%)`;
        }
    }
    const splitLabel = doc.splitTextToSize(`${discountLabelText}:`, totalsValueX - totalsLabelX - 25);
    doc.text(splitLabel, totalsLabelX, yOffset);
    doc.text(`-${currencySymbol}${discountAmount.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
    yOffset += (splitLabel.length * 5);
    doc.setTextColor(40);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${getLabel('net_amount_label')}:`, totalsLabelX, yOffset);
  doc.text(`${currencySymbol}${netAmount.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  yOffset += 7;
  doc.setFont('helvetica', 'normal');

  if (taxAmount > 0) {
    const taxName = property?.taxSettings?.name || getLabel('tax_label');
    const taxRate = property?.taxSettings?.rate ? `(${property.taxSettings.rate}%)` : '';
    doc.text(`${getLabel('tax_label', {name: taxName, rate: property?.taxSettings?.rate || 0})}:`, totalsLabelX, yOffset);
    doc.text(`${currencySymbol}${taxAmount.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
    yOffset += 7;
  }

  yOffset += 2;
  doc.setLineWidth(0.3);
  doc.line(totalsLabelX - 5, yOffset, totalsValueX, yOffset);
  yOffset += 7;

  // --- Grand Total & Payment Breakdown ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${getLabel('grand_total_label')}:`, totalsLabelX, yOffset);
  doc.text(`${currencySymbol}${grandTotal.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  yOffset += 8;
  
  doc.setFontSize(10);
  if (totalPaid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 100, 0); // Green color for paid amount
    doc.text(`${getLabel('pdf_content:total_paid_label')}:`, totalsLabelX, yOffset);
    doc.text(`-${currencySymbol}${totalPaid.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
    yOffset += 7;
  }

  if (invoice.paymentStatus !== 'Paid') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0); // Red color for amount due
    doc.text(`${getLabel('amount_due_label')}:`, totalsLabelX, yOffset);
    doc.text(`${currencySymbol}${amountDue.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  }

  const statusY = Math.max(yOffset + 20, pageHeight - 50);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  const paymentStatusText = getLabel(`status/status_content:payment.${invoice.paymentStatus.toLowerCase()}`, { defaultValue: invoice.paymentStatus });
  doc.text(`${getLabel('status_label')}: ${paymentStatusText}`, 20, statusY);
  
  const stampUrl = invoiceSettings.companyStampUrl;
  if (stampUrl) {
    try {
      const stampHeight = invoiceSettings.companyStampSize || 25;
      let stampDataUri = stampUrl;
      if (stampUrl.includes('firebasestorage.googleapis.com')) {
          // Fix: Use getApp() to retrieve the default app instance
          const app = (await import('./firebase')).app; 
          const functions = getFunctions(app, 'europe-west1');
          const fetchImageProxy = httpsCallable(functions, 'fetchImageProxy');
          const result: any = await fetchImageProxy({ url: stampUrl });
          stampDataUri = (result.data as any).dataUri;
      }
      const imgProps = doc.getImageProperties(stampDataUri);
      const stampWidth = (imgProps.width * stampHeight) / imgProps.height;
      const stampX = pageWidth - margin - stampWidth;
      
      let stampY = yOffset + 5;
      if (stampY + stampHeight > pageHeight - 30) {
        // Not enough space for stamp AND footer, add page
        doc.addPage();
        stampY = pageHeight - margin - stampHeight - 20; // Position it at the bottom area of new page
      } else {
         stampY = pageHeight - margin - stampHeight - 20;
      }
      
      doc.addImage(stampDataUri, 'PNG', stampX, stampY, stampWidth, stampHeight);
    } catch(e) {
       console.error("Could not add stamp to PDF:", e);
    }
  }


  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const legalInfo = property?.legalInformation;
    let legalY = pageHeight - 15;

    if (legalInfo) {
      const legalDetails = [
          legalInfo.companyName,
          legalInfo.legalForm && `${getLabel('capital_label')}: ${legalInfo.capitalAmount}`,
          legalInfo.businessAddress,
          legalInfo.rcNumber && `RC: ${legalInfo.rcNumber}`,
          legalInfo.ifNumber && `IF: ${legalInfo.ifNumber}`,
          legalInfo.patenteNumber && `Patente: ${legalInfo.patenteNumber}`,
          legalInfo.iceNumber && `ICE: ${legalInfo.iceNumber}`,
          legalInfo.phone && `${getLabel('phone_label')}: ${legalInfo.phone}`,
          legalInfo.email,
          legalInfo.website,
          legalInfo.tvaInfo,
          legalInfo.bankAccountNumber && `${getLabel('bank_account_label')}: ${legalInfo.bankAccountNumber}`,
          legalInfo.iban && `IBAN: ${legalInfo.iban}`,
      ].filter(Boolean);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150);
      const legalText = legalDetails.join(' | ');
      const splitText = doc.splitTextToSize(legalText, pageWidth - 30);
      const textHeight = splitText.length * 3.5;
      
      legalY = pageHeight - 10 - textHeight;
      doc.text(splitText, pageWidth / 2, legalY, { align: 'center' });
    }
    
    // Position page number at the very bottom
    const pageNumY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text(`${getLabel('page_label')} ${i} ${getLabel('of_label')} ${pageCount}`, pageWidth / 2, pageNumY, { align: 'center' });
  }

  return doc;
}
