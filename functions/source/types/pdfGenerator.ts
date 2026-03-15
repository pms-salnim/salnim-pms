
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

import type { Invoice, Payment } from '@shared/payment';
import type { Property } from '@shared/property';
import type { Reservation } from '@shared/reservation';


export async function generateInvoicePdf(
  invoice: Invoice,
  property: Property | null,
  reservation: Reservation | null,
  payments?: Payment[],
  labels?: Record<string, string> // For i18n
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;

  const invoiceSettings = property?.invoiceCustomization || {};
  const currencySymbol = property?.currency || '$';
  const primaryColor = invoiceSettings.primaryColor || '#003166';
  
  const t = (key: string, options?: any): string => {
    const fullKey = `pdf_content:${key}`;
    let translation = (labels?.[fullKey]) || key;
    if (options) {
      Object.keys(options).forEach(optKey => {
        translation = translation.replace(`{{${optKey}}}`, options[optKey]);
      });
    }
    return translation;
  };
  
  // --- Document Properties ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // --- Header ---
  let yOffset = 20;

  // Invoice Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor);
  doc.text(t('invoice_title'), pageWidth - 15, yOffset, { align: 'right' });
  
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
  doc.text(`${t('invoice_number_label')}:`, 140, yOffset);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, pageWidth - 20, yOffset, { align: 'right' });
  
  yOffset += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`${t('date_issued_label')}:`, 140, yOffset);
  doc.setFont('helvetica', 'bold');
  doc.text(`${format(parseISO(invoice.dateIssued), 'PP')}`, pageWidth - 20, yOffset, { align: 'right' });
  
  yOffset += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`${t('due_date_label')}:`, 140, yOffset);
  doc.setFont('helvetica', 'bold');
  doc.text(`${format(parseISO(invoice.dueDate), 'PP')}`, pageWidth - 20, yOffset, { align: 'right' });

  // --- Bill To ---
  yOffset = 80;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('bill_to_label')}:`, 20, yOffset);
  yOffset += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const guestInfo = [
    invoice.guestOrCompany,
    reservation?.guestEmail,
    reservation?.guestPhone,
  ].filter(Boolean) as string[];
  doc.text(guestInfo, 20, yOffset);
  yOffset += guestInfo.length * 5;

  if (invoice.reservationId) {
    yOffset = Math.max(yOffset, 87); // ensure yOffset doesn't go backwards
    doc.text(`${t('reservation_id_label')}: ${reservation?.reservationNumber || invoice.reservationId}`, 20, yOffset);
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
    t('description_label'),
    t('qty_label'),
    t('unit_price_label'),
    t('total_label'),
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
  doc.text(`${t('subtotal_label')}:`, totalsLabelX, yOffset);
  doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  yOffset += 7;
  
  if (discountAmount > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(0, 150, 0);
    const promotion = reservation?.promotionApplied; 
    let discountLabelText = t('discount_label');
    if (promotion) {
        if (promotion.discountType === 'percentage') {
            discountLabelText = `${t('discount_label')} (${promotion.discountValue}%)`;
        }
    }
    const splitLabel = doc.splitTextToSize(`${discountLabelText}:`, totalsValueX - totalsLabelX - 25);
    doc.text(splitLabel, totalsLabelX, yOffset);
    doc.text(`-${currencySymbol}${discountAmount.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
    yOffset += (splitLabel.length * 5);
    doc.setTextColor(40);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('net_amount_label')}:`, totalsLabelX, yOffset);
  doc.text(`${currencySymbol}${netAmount.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  yOffset += 7;
  doc.setFont('helvetica', 'normal');

  if (taxAmount > 0) {
    const taxName = property?.taxSettings?.name || t('tax_label');
    const taxRate = property?.taxSettings?.rate ? `(${property.taxSettings.rate}%)` : '';
    doc.text(`${taxName} ${taxRate}:`, totalsLabelX, yOffset);
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
  doc.text(`${t('grand_total_label')}:`, totalsLabelX, yOffset);
  doc.text(`${currencySymbol}${grandTotal.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  yOffset += 8;
  
  doc.setFontSize(10);
  if (totalPaid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 100, 0); 
    doc.text(`${t('total_paid_label')}:`, totalsLabelX, yOffset);
    doc.text(`-${currencySymbol}${totalPaid.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
    yOffset += 7;
  }

  if (invoice.paymentStatus !== 'Paid') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0); 
    doc.text(`${t('amount_due_label')}:`, totalsLabelX, yOffset);
    doc.text(`${currencySymbol}${amountDue.toFixed(2)}`, totalsValueX, yOffset, { align: 'right' });
  }

  const statusY = Math.max(yOffset + 20, pageHeight - 50);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  const paymentStatusText = t(`status/status_content:payment.${invoice.paymentStatus.toLowerCase()}`, { defaultValue: invoice.paymentStatus });
  doc.text(`${t('status_label')}: ${paymentStatusText}`, 20, statusY);
  
  const stampUrl = invoiceSettings.companyStampUrl;
  if (stampUrl) {
    try {
      const stampHeight = invoiceSettings.companyStampSize || 25;
      let stampDataUri = stampUrl;
      if (stampUrl.includes('firebasestorage.googleapis.com')) {
          // Fix: Use getApp() to retrieve the default app instance
          const appInstance = getApp(); 
          const functions = getFunctions(appInstance, 'europe-west1');
          const fetchImageProxy = httpsCallable(functions, 'fetchImageProxy');
          const result: any = await fetchImageProxy({ url: stampUrl });
          stampDataUri = (result.data as any).dataUri;
      }
      const imgProps = (doc as any).getImageProperties(stampDataUri);
      const stampWidth = (imgProps.width * stampHeight) / imgProps.height;
      const stampX = pageWidth - margin - stampWidth;
      const stampY = Math.max(statusY - stampHeight, finalContentY + 10);
      doc.addImage(stampDataUri, 'PNG', stampX, stampY, stampWidth, stampHeight);
    } catch(e) {
       console.error("Could not add stamp to PDF:", e);
    }
  }

  // --- Footer ---
  const legalInfo = property?.legalInformation;
  if (legalInfo) {
    const legalDetails = [
        legalInfo.companyName,
        legalInfo.legalForm && `${t('capital_label')}: ${legalInfo.capitalAmount}`,
        legalInfo.businessAddress,
        legalInfo.rcNumber && `RC: ${legalInfo.rcNumber}`,
        legalInfo.ifNumber && `IF: ${legalInfo.ifNumber}`,
        legalInfo.patenteNumber && `Patente: ${legalInfo.patenteNumber}`,
        legalInfo.iceNumber && `ICE: ${legalInfo.iceNumber}`,
        legalInfo.phone && `${t('phone_label')}: ${legalInfo.phone}`,
        legalInfo.email,
        legalInfo.website,
        legalInfo.tvaInfo,
    ].filter(Boolean);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    const legalText = legalDetails.join(' | ');
    const splitText = doc.splitTextToSize(legalText, pageWidth - 30);
    doc.text(splitText, pageWidth / 2, pageHeight - 15, { align: 'center' });
  }

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageNumY = pageHeight - 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text(`${t('page_label')} ${i} ${t('of_label')} ${pageCount}`, pageWidth / 2, pageNumY, { align: 'center' });
  }

  return doc;
}
