
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Property } from '@/types/property';
import type { Reservation, SelectedExtra } from '@/components/calendar/types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import i18n from './i18n';
import type { Expense } from '@/types/expense'; // Import Expense type

export type ReportData = {
  metrics: {
    totalRevenue: number;
    roomsRevenue: number;
    extrasRevenue: number;
    totalBookings: number;
    averageDailyRate: number;
    occupancyRate: number;
    revPAR: number;
    avgStayLength: number;
    totalRevenueGross: number;
    totalDiscounts: number;
    totalTaxes: number;
    totalExpenses: number; // Add this
    netRevenue: number;
    netProfit: number; // Add this
    paidWithPointsValue: number;
  };
  reservations: Reservation[];
  dateRange: { from: Date; to: Date };
  filters: {
      roomType: string;
      bookingSource: string;
  };
  breakdownByRoomAndType: {
    roomTypeName: string;
    occupancy: number;
    adr: number;
    revenue: number;
    rooms: { name: string; occupancy: number; adr: number; revenue: number }[];
  }[];
  extrasBreakdown: { name: string; quantity: number; total: number }[];
  expenses: Expense[]; // Add this
}

export async function generatePerformanceReportPdf(
  reportData: ReportData,
  property: Property | null,
  lang: 'en' | 'fr',
  labels: Record<string, string>
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  const primaryColor = property?.invoiceCustomization?.primaryColor || '#003166';
  
  const legalInfo = property?.legalInformation || {};
  
  const legalDetails = [
      legalInfo.rcNumber && `RC: ${legalInfo.rcNumber}`,
      legalInfo.iceNumber && `ICE: ${legalInfo.iceNumber}`,
      legalInfo.ifNumber && `IF: ${legalInfo.ifNumber}`,
      legalInfo.patenteNumber && `CNSS: ${legalInfo.patenteNumber}`,
  ].filter(Boolean).join(' – ');

  let yOffset = 15;

  const logoUrl = property?.bookingPageSettings?.logoUrl || property?.invoiceCustomization?.logoUrl;
  if (logoUrl) {
    if (logoUrl.startsWith('data:image')) {
       const imgProps = doc.getImageProperties(logoUrl);
        const logoHeight = 25;
        const logoWidth = (imgProps.width * logoHeight) / imgProps.height;
        doc.addImage(logoUrl, imgProps.fileType, (pageWidth - logoWidth) / 2, yOffset, logoWidth, logoHeight);
        yOffset += logoHeight + 5;
    } else if (logoUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const functions = getFunctions(app, 'europe-west1');
        const fetchImageProxy = httpsCallable(functions, 'fetchImageProxy');
        const result: any = await fetchImageProxy({ url: logoUrl });
        const logoDataUri = result.data.dataUri;
        const imgProps = doc.getImageProperties(logoDataUri);
        const logoHeight = 25;
        const logoWidth = (imgProps.width * logoHeight) / imgProps.height;
        doc.addImage(logoDataUri, imgProps.fileType, (pageWidth - logoWidth) / 2, yOffset, logoWidth, logoHeight);
        yOffset += logoHeight + 5;
      } catch (error) {
        console.error("Failed to fetch logo for PDF:", error);
      }
    }
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(legalInfo.companyName || property?.name || 'Property Report', pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(legalInfo.businessAddress || property?.address || '', pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;
  doc.text(`${legalInfo.phone || property?.phone} | ${legalInfo.email || property?.email}`, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;
  doc.text(legalDetails, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;

  yOffset += 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.performanceReportTitle || 'Performance Report', pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 30, yOffset, pageWidth / 2 + 30, yOffset);

  yOffset += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateRangeString = `${labels.periodLabel || 'Period'}: ${format(reportData.dateRange.from, 'PP')} to ${format(reportData.dateRange.to, 'PP')}`;
  doc.text(dateRangeString, pageWidth / 2, yOffset, { align: 'center' });
  
  // --- Property Overview ---
  yOffset += 15;
  if (yOffset > pageHeight - 80) { doc.addPage(); yOffset = 15; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.propertyOverviewTitle || 'Property Overview', 15, yOffset);
  
  autoTable(doc, {
    startY: yOffset + 5,
    head: [[labels.metricLabel, labels.valueLabel]],
    body: [
      [labels.totalBookingsLabel, reportData.metrics.totalBookings.toString()],
      [labels.occupancyRateLabel, `${reportData.metrics.occupancyRate.toFixed(1)}%`],
      [labels.avgStayLabel, `${reportData.metrics.avgStayLength.toFixed(1)} ${labels.nightsLabel}`],
      [labels.adrLabel, `${property?.currency || '$'}${reportData.metrics.averageDailyRate.toFixed(2)}`],
      [labels.revparLabel, `${property?.currency || '$'}${reportData.metrics.revPAR.toFixed(2)}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    didDrawPage: data => yOffset = data.cursor?.y || yOffset
  });
  
  yOffset = (doc as any).lastAutoTable.finalY + 10;
  
  // --- Revenue Breakdowns ---
  if (reportData.breakdownByRoomAndType.length > 0) {
    if (yOffset > pageHeight - 60) { doc.addPage(); yOffset = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(labels.roomBreakdownTitle, 15, yOffset);

    const roomBreakdownBody: any[] = [];
    reportData.breakdownByRoomAndType.forEach(group => {
      roomBreakdownBody.push([
        { content: group.roomTypeName, styles: { fontStyle: 'bold', halign: 'left' } },
        { content: `${group.occupancy.toFixed(1)}%`, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${property?.currency || '$'}${group.adr.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${property?.currency || '$'}${group.revenue.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } },
      ]);
      
      group.rooms.forEach(item => {
        roomBreakdownBody.push([
          { content: `    ${item.name}`, styles: { halign: 'left' } },
          { content: `${item.occupancy.toFixed(1)}%`, styles: { halign: 'right' } },
          { content: `${property?.currency || '$'}${item.adr.toFixed(2)}`, styles: { halign: 'right' } },
          { content: `${property?.currency || '$'}${item.revenue.toFixed(2)}`, styles: { halign: 'right' } },
        ]);
      });
    });

    const totalRoomBreakdownRevenue = reportData.breakdownByRoomAndType.reduce((sum, group) => sum + group.revenue, 0);

    autoTable(doc, {
      startY: yOffset + 5,
       head: [[
          { content: labels.roomTypeHeader, styles: { halign: 'left' } },
          { content: labels.occupancyHeader, styles: { halign: 'right' } },
          { content: labels.adrHeader, styles: { halign: 'right' } },
          { content: labels.totalRevenueHeader, styles: { halign: 'right' } },
      ]],
      body: roomBreakdownBody,
      foot: [
        [
            { content: labels.totalLabel, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] } },
            { content: `${property?.currency || '$'}${totalRoomBreakdownRevenue.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }
        ]
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
      styles: { fontSize: 9, cellPadding: 2 },
      didDrawPage: data => yOffset = data.cursor?.y || yOffset
    });
    yOffset = (doc as any).lastAutoTable.finalY + 10;
  }
  
  if (reportData.extrasBreakdown.length > 0) {
    if (yOffset > pageHeight - 60) { doc.addPage(); yOffset = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(labels.extrasBreakdownTitle, 15, yOffset);
    
    const { totalQuantity, totalRevenue } = reportData.extrasBreakdown.reduce((acc, item) => {
        acc.totalQuantity += item.quantity;
        acc.totalRevenue += item.total;
        return acc;
    }, { totalQuantity: 0, totalRevenue: 0 });

    autoTable(doc, {
      startY: yOffset + 5,
       head: [[
          { content: labels.extraNameHeader, styles: { halign: 'left' } },
          { content: labels.quantitySoldHeader, styles: { halign: 'right' } },
          { content: labels.totalRevenueHeader, styles: { halign: 'right' } },
      ]],
      body: reportData.extrasBreakdown.map(item => [
        item.name,
        item.quantity.toString(),
        `${property?.currency || '$'}${item.total.toFixed(2)}`,
      ]),
      foot: [
        [
            { content: labels.totalLabel, colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] } },
            { content: `${property?.currency || '$'}${totalRevenue.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }
        ]
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      didDrawPage: data => yOffset = data.cursor?.y || yOffset
    });
     yOffset = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Expenses Table ---
  if (reportData.expenses.length > 0) {
    if (yOffset > pageHeight - 60) { doc.addPage(); yOffset = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(labels.expensesTitle, 15, yOffset);

    autoTable(doc, {
      startY: yOffset + 5,
      head: [[
        { content: labels.dateHeader, styles: { halign: 'left' } },
        { content: labels.expenseNameHeader, styles: { halign: 'left' } },
        { content: labels.categoryHeader, styles: { halign: 'left' } },
        { content: labels.amountHeader, styles: { halign: 'right' } },
      ]],
      body: reportData.expenses.map(exp => [
        format(new Date(exp.date), 'PP'),
        exp.expenseName,
        exp.category,
        `${property?.currency || '$'}${exp.amount.toFixed(2)}`,
      ]),
       foot: [
        [
            { content: labels.totalLabel, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] } },
            { content: `${property?.currency || '$'}${reportData.metrics.totalExpenses.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }
        ]
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 3: { halign: 'right' } },
      didDrawPage: data => yOffset = data.cursor?.y || yOffset
    });
    yOffset = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Financial Summary ---
  if (yOffset > pageHeight - 80) { doc.addPage(); yOffset = 15; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.financialSummaryTitle, 15, yOffset);
  
  const financialSummaryBody = [
    [labels.roomsRevenueLabel, `${property?.currency || '$'}${reportData.metrics.roomsRevenue.toFixed(2)}`],
    [labels.extrasRevenueLabel, `${property?.currency || '$'}${reportData.metrics.extrasRevenue.toFixed(2)}`],
    [{ content: labels.totalRevenueGrossLabel, styles: {fontStyle: 'bold'} }, { content: `${property?.currency || '$'}${reportData.metrics.totalRevenueGross.toFixed(2)}`, styles: {fontStyle: 'bold'} }],
    [labels.discountsAppliedLabel, `-${property?.currency || '$'}${reportData.metrics.totalDiscounts.toFixed(2)}`],
    [{ content: labels.netRevenueLabel, styles: {fontStyle: 'bold'}}, { content: `${property?.currency || '$'}${reportData.metrics.netRevenue.toFixed(2)}`, styles: {fontStyle: 'bold'}}],
    [labels.totalExpensesLabel, `-${property?.currency || '$'}${reportData.metrics.totalExpenses.toFixed(2)}`],
    [
        {
            content: `${labels.netProfitLabel} (${reportData.metrics.netProfit >= 0 ? labels.benefitLabel : labels.lossLabel})`,
            styles: {fontStyle: 'bold'}
        },
        {
            content: `${property?.currency || '$'}${reportData.metrics.netProfit.toFixed(2)}`,
            styles: { fontStyle: 'bold', textColor: reportData.metrics.netProfit >= 0 ? [0, 100, 0] : [255, 0, 0] }
        }
    ],
    [labels.taxesAndFeesLabel, `${property?.currency || '$'}${reportData.metrics.totalTaxes.toFixed(2)}`],
    [labels.paidWithLoyaltyLabel, `-${property?.currency || '$'}${reportData.metrics.paidWithPointsValue.toFixed(2)}`],
  ];

  autoTable(doc, {
    startY: yOffset + 5,
    head: [[labels.descriptionHeader, labels.amountHeader]],
    body: financialSummaryBody,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'normal' }, 1: {halign: 'right'} },
    didDrawPage: data => yOffset = data.cursor?.y || yOffset
  });


  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated by Salnim Pms`, 15, footerY);
    if(property?.website) {
       doc.text(property.website, pageWidth / 2, footerY, { align: 'center' });
    }
    doc.text(`${labels.pageLabel} ${i} ${labels.ofLabel} ${pageCount}`, pageWidth - 15, footerY, { align: 'right' });
  }

  return doc;
}
