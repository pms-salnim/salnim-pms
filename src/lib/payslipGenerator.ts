
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Property } from '@/types/property';
import type { StaffMember } from '@/types/staff';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import i18n from './i18n'; // Import i18n instance

export interface RemunerationItem {
    label: string;
    base?: number | string;
    rate?: number | string;
    gain?: number;
}

export interface DeductionItem {
    label: string;
    base?: number | string;
    rate?: number | string;
    deduction?: number;
}

export interface PayslipData {
    companyName: string;
    companyAddress: string;
    companyCity: string;
    companyCnss: string;
    periodStart: string;
    periodEnd: string;
    employeeName: string;
    employeeCin: string;
    employeeDepartment: string;
    employeePosition: string;
    employeeHireDate: string;
    employeeCnss: string;
    baseSalary: number;
    employeeAddress: string;
    paymentMethod: string;
    remunerationItems: RemunerationItem[];
    deductionItems: DeductionItem[];
    grossSalary: number;
    netSalary: number;
}

export async function generatePayslipPdf(
  data: PayslipData,
  property: Property,
  lang: 'en' | 'fr'
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const currency = property.currency || 'MAD';

  let y = margin;

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.companyAddress, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(data.companyCity, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BULLETIN DE PAIE', margin, y);
  y += 8;

  // Pay Period Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° CNSS : ${data.companyCnss}`, margin, y);
  y += 6;
  doc.text(`Période de paie du : ${data.periodStart}`, margin, y);
  y += 6;
  doc.text(`Période de paie au : ${data.periodEnd}`, margin, y);
  y += 10;

  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Employee Info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations du salarié', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5, lineColor: '#fff' },
    body: [
      [`Nom et prénom : ${data.employeeName}`, `CIN : ${data.employeeCin}`],
      [`Département / Service : ${data.employeeDepartment}`, `Qualification : ${data.employeePosition}`],
      [`Date d'embauche : ${data.employeeHireDate}`, `N° CNSS : ${data.employeeCnss}`],
      [{ content: `Salaire de base : ${data.baseSalary.toFixed(2)} ${currency}`, colSpan: 2 }],
      [{ content: `Adresse : ${data.employeeAddress}`, colSpan: 2 }],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Détails de la paie', margin, y);
  y += 8;

  const tableBody = [
    ...data.remunerationItems.map(item => [
      item.label,
      item.base || '-',
      item.rate || '-',
      `${(Number(item.gain) || 0).toFixed(2)}`,
      '',
    ]),
    [
      { content: 'Salaire brut', styles: { fontStyle: 'bold' } },
      '', '',
      { content: `${data.grossSalary.toFixed(2)}`, styles: { fontStyle: 'bold' } },
      ''
    ],
    ...data.deductionItems.map(item => [
      item.label,
      item.base || '-',
      item.rate || '-',
      '',
      `${(Number(item.deduction) || 0).toFixed(2)}`,
    ]),
  ];

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Libellé', 'Base / Nombre', 'Taux (%)', `À Payer (${currency})`, `À Déduire (${currency})`]],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [230, 230, 230], textColor: 20 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    didDrawPage: (data) => {
        y = data.cursor?.y || y;
    }
  });
  y = (doc as any).lastAutoTable.finalY;

  // Net Salary
  autoTable(doc, {
      startY: y,
      theme: 'grid',
      body: [
          [
              { content: 'Salaire net à payer', styles: { fontStyle: 'bold', halign: 'right' } },
              { content: `${data.netSalary.toFixed(2)} ${currency}`, styles: { fontStyle: 'bold', halign: 'right' } },
          ]
      ],
      columnStyles: {
          0: { cellWidth: pageWidth - margin * 2 - 40 },
          1: { cellWidth: 40 },
      },
      styles: { fontSize: 10, cellPadding: 3, fontStyle: 'bold' },
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // Signature section at the end of the content
  const finalY = (doc as any).lastAutoTable.finalY || y;
  let signatureY = finalY + 15;
  if (signatureY > pageHeight - 40) {
      doc.addPage();
      signatureY = margin;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mode de paiement : ${data.paymentMethod}`, margin, signatureY);
  signatureY += 15;

  const stampUrl = property.invoiceCustomization?.companyStampUrl;
  if (stampUrl) {
    try {
      const stampHeight = 25; // Define stamp height
      let stampDataUri = stampUrl;
      if (stampUrl.includes('firebasestorage.googleapis.com')) {
          const functions = getFunctions(app, 'europe-west1');
          const fetchImageProxy = httpsCallable(functions, 'fetchImageProxy');
          const result: any = await fetchImageProxy({ url: stampUrl });
          stampDataUri = result.data.dataUri;
      }
      const imgProps = doc.getImageProperties(stampDataUri);
      const stampWidth = (imgProps.width * stampHeight) / imgProps.height;
      const stampX = pageWidth - margin - stampWidth;
      doc.addImage(stampDataUri, 'PNG', stampX, signatureY, stampWidth, stampHeight);
      signatureY += stampHeight + 2;
    } catch(e) {
       console.error("Could not add stamp to PDF:", e);
    }
  }

  doc.setFontSize(11);
  doc.text(`Fait à ${property.city || 'not specified'}, le ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth - margin, signatureY, { align: 'right' });
  
  return doc;
}
