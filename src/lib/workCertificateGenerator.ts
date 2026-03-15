
import jsPDF from 'jspdf';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { toast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import i18n from './i18n';

const drawTextWithHighlights = (doc: jsPDF, text: string, partsToHighlight: string[], x: number, y: number, maxWidth: number) => {
    const normalFont = 'helvetica';
    const boldFont = 'helvetica';
    const boldStyle = 'bold';
    const normalStyle = 'normal';

    const safeParts = partsToHighlight.filter(p => p && typeof p === 'string' && p.trim() !== '');
    if (safeParts.length === 0) {
        doc.setFont(normalFont, normalStyle);
        doc.text(text, x, y, { maxWidth });
        return doc.getTextDimensions(text, { maxWidth }).h;
    }

    const splitRegex = new RegExp(`(${safeParts.map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`, 'g');
    
    let yOffset = y;
    const lines = doc.splitTextToSize(text, maxWidth);

    lines.forEach((line: string) => {
        let currentX = x;
        const parts = line.split(splitRegex).filter(Boolean);

        parts.forEach(part => {
            const isHighlighted = safeParts.includes(part);
            doc.setFont(normalFont, isHighlighted ? boldStyle : normalStyle);
            doc.text(part, currentX, yOffset);
            currentX += doc.getTextWidth(part);
        });
        
        yOffset += 7;
    });
    
    return yOffset - y;
};

export async function generateWorkCertificatePdf(
  content: Record<string, string>,
  property: Property
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  const legalInfo = property?.legalInformation || {};
  
  const legalDetails = [
      legalInfo.rcNumber && `RC: ${legalInfo.rcNumber}`,
      legalInfo.iceNumber && `ICE: ${legalInfo.iceNumber}`,
      legalInfo.ifNumber && `IF: ${legalInfo.ifNumber}`,
      legalInfo.patenteNumber && `CNSS: ${legalInfo.patenteNumber}`,
  ].filter(Boolean).join(' – ');

  let yOffset = 15;

  const logoUrl = property.bookingPageSettings?.logoUrl || property.invoiceCustomization?.logoUrl;
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
  doc.text(legalInfo.companyName || property.name, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(legalInfo.businessAddress || property.address, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;
  doc.text(`${legalInfo.phone || property.phone} | ${legalInfo.email || property.email}`, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;
  doc.text(legalDetails, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;

  yOffset += 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(content.title, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 5;
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 30, yOffset, pageWidth / 2 + 30, yOffset);

  yOffset += 20;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setLineHeightFactor(1.5);
  
  const textWithoutTags = (text: string) => text.replace(/<\/?b>/g, '');
  const highlights = [
    content.companyName, 
    content.fullName,
    content.cin,
    content.address,
    content.role,
    content.hireDate,
    content.lastName
  ];

  yOffset += drawTextWithHighlights(doc, textWithoutTags(content.certify), highlights, margin, yOffset, contentWidth);
  yOffset += 7;
  yOffset += drawTextWithHighlights(doc, textWithoutTags(content.employee), highlights, margin + 10, yOffset, contentWidth - 10);
  yOffset += 7;
  yOffset += drawTextWithHighlights(doc, textWithoutTags(content.currentStatus), highlights, margin + 10, yOffset, contentWidth - 10);
  yOffset += 7;
  yOffset += drawTextWithHighlights(doc, textWithoutTags(content.purpose), highlights, margin, yOffset, contentWidth);

  yOffset = pageHeight - 60; // Adjusted for stamp
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(content.issuedAt, pageWidth - margin, yOffset, { align: 'right' });
  yOffset += 15;
  
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
      doc.addImage(stampDataUri, 'PNG', stampX, yOffset, stampWidth, stampHeight);
      yOffset += stampHeight + 2;
    } catch(e) {
       console.error("Could not add stamp to PDF:", e);
    }
  }

  doc.text(content.signature, pageWidth - margin, yOffset, { align: 'right' });

  return doc;
}
