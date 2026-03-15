
"use client";

import React, { useRef, useState, useEffect } from 'react';
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
import { Icons } from "@/components/icons";
import type { StaffMember } from '@/types/staff';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import type { Property } from '@/types/property';
import { generateWorkCertificatePdf } from '@/lib/workCertificateGenerator';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import i18n from '@/lib/i18n';

interface WorkCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
}

const WorkCertificateDocument = React.forwardRef<HTMLDivElement, { content: Record<string, string>, property: Property | null }>(({ content, property }, ref) => {
    const legalInfo = property?.legalInformation || {};
    const legalDetails = [
        legalInfo.rcNumber && `RC: ${legalInfo.rcNumber}`,
        legalInfo.iceNumber && `ICE: ${legalInfo.iceNumber}`,
        legalInfo.ifNumber && `IF: ${legalInfo.ifNumber}`,
        legalInfo.patenteNumber && `CNSS: ${legalInfo.patenteNumber}`,
    ].filter(Boolean).join(' – ');

    return (
        <div ref={ref} className="p-10 bg-white text-black font-serif text-sm">
             <header className="text-center mb-10">
                <p className="font-bold text-lg">{content.companyName}</p>
                <p className="text-xs">{legalInfo.legalForm}</p>
                <p className="text-xs">{legalInfo.businessAddress}</p>
                <p className="text-xs">{legalDetails}</p>
                <p className="text-xs">{legalInfo.phone && `📞 ${legalInfo.phone}`} {legalInfo.email && `| ✉️ ${legalInfo.email}`}</p>
            </header>
            
            <div className="text-center my-10">
                 <h1 className="text-xl font-bold uppercase underline">{content.title}</h1>
            </div>
            
            <div className="space-y-6 leading-relaxed">
                <p dangerouslySetInnerHTML={{ __html: (content.certify || '').replace(/\n/g, '<br/>') }} />
                <p className="pl-4" dangerouslySetInnerHTML={{ __html: (content.employee || '').replace(/\n/g, '<br/>') }} />
                <p className="pl-4" dangerouslySetInnerHTML={{ __html: (content.currentStatus || '').replace(/\n/g, '<br/>') }} />
                <p dangerouslySetInnerHTML={{ __html: (content.purpose || '').replace(/\n/g, '<br/>') }} />
            </div>
            <div className="mt-16 flex justify-between items-end">
                <div className="text-sm">
                    <p>{content.issuedAt}</p>
                </div>
                <div className="text-center">
                    <div className="w-48 h-16"></div> {/* Placeholder for stamp */}
                    <p className="mt-2 text-sm">{content.signature}</p>
                </div>
            </div>
        </div>
    );
});
WorkCertificateDocument.displayName = 'WorkCertificateDocument';


export default function WorkCertificateModal({ isOpen, onClose, staffMember }: WorkCertificateModalProps) {
  const { property } = useAuth();
  const [language, setLanguage] = useState<'en' | 'fr'>('fr');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  
  const { t } = useTranslation('pages/staff/management');

    const generateContent = (lang: 'en' | 'fr', staff: StaffMember, prop: Property | null) => {
        const today = new Date();
        const legalInfo = prop?.legalInformation || {};
        const tDoc = i18n.getFixedT(lang, 'pages/staff/management');
        
        const dynamicData = {
            companyName: (legalInfo.companyName || prop?.name || '').toUpperCase(),
            fullName: (staff.fullName).toUpperCase(),
            lastName: (staff.fullName.split(' ').slice(-1)[0] || '').toUpperCase(),
            cin: (staff.cin || 'N/A').toUpperCase(),
            address: (staff.address || '').toUpperCase(),
            role: tDoc(`positions.${staff.role}`),
            hireDate: (staff.hireDate ? new Date(staff.hireDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A').toUpperCase(),
        };

        const contentTemplates = {
            en: {
                title: "WORK CERTIFICATE",
                certify: `We, the undersigned, ${dynamicData.companyName}, hereby certify that:`,
                employee: `Mr./Ms. ${dynamicData.fullName}, holder of CIN No. ${dynamicData.cin}, residing at ${dynamicData.address}, has been an employee of our company since ${dynamicData.hireDate}, where they hold the position of ${dynamicData.role}.`,
                currentStatus: `As of the date of this certificate, Mr./Ms. ${dynamicData.lastName} is still actively employed with the company.`,
                purpose: "This certificate is issued at the request of the employee to serve for all legal purposes.",
                issuedAt: `Issued in ${prop?.city || 'not specified'}, on ${today.toLocaleDateString('en-US')}`,
                signature: "Signature and Stamp of the Company"
            },
            fr: {
                title: "ATTESTATION DE TRAVAIL",
                certify: `Nous soussignés, ${legalInfo.companyName || prop?.name}, certifions que :`,
                employee: `M./Mme ${dynamicData.fullName},\ntitulaire de la CIN n° ${dynamicData.cin}, demeurant à ${dynamicData.address},\noccupe le poste de ${dynamicData.role} au sein de notre société depuis le ${dynamicData.hireDate}.`,
                currentStatus: `À la date de délivrance de la présente attestation, M./Mme ${dynamicData.lastName} est toujours en fonction au sein de l’entreprise.`,
                purpose: "La présente attestation est délivrée à la demande de l’intéressé(e) pour servir et valoir ce que de droit.",
                issuedAt: `Fait à ${prop?.city || 'non précisé'}, le ${today.toLocaleDateString('fr-FR')}`,
                signature: "Signature et cachet de l’entreprise"
            }
        };

        return { ...contentTemplates[lang], ...dynamicData };
    };

  useEffect(() => {
    if (staffMember && property) {
        setEditableContent(generateContent(language, staffMember, property));
    }
  }, [staffMember, property, language]);


  const handlePrint = async () => {
    if (!staffMember || !property) {
      toast({ title: "Error", description: "Missing required data to generate PDF.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const pdf = await generateWorkCertificatePdf(editableContent, property);
      pdf.save(`attestation-de-travail-${staffMember.fullName.replace(/\s/g, '-')}.pdf`);
    } catch (error) {
      console.error("Error generating work certificate PDF:", error);
      toast({ title: "PDF Generation Failed", description: "An error occurred while creating the PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContentChange = (field: string, value: string) => {
    setEditableContent(prev => ({...prev, [field]: value}));
  };

  if (!staffMember || !property) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('work_certificate_modal.title', { name: staffMember.fullName })}</DialogTitle>
          <DialogDescription>{t('work_certificate_modal.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-between items-center gap-2 -mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
              <Icons.Edit className="h-4 w-4 mr-2"/>
              {isEditing ? t('buttons.preview_document') : t('buttons.edit_document')}
            </Button>
            <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{t('work_certificate_modal.language_label')}</Label>
                <Button variant={language === 'en' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('en')}>English</Button>
                <Button variant={language === 'fr' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('fr')}>Français</Button>
            </div>
        </div>

        <div className="border rounded-md bg-gray-100 max-h-[50vh] overflow-auto">
          {isEditing ? (
            <div className="p-4 space-y-3 bg-white">
              <div className="space-y-1">
                <Label htmlFor="edit-certify" className="font-semibold text-xs">Certify Paragraph</Label>
                <Textarea id="edit-certify" value={editableContent.certify} onChange={(e) => handleContentChange('certify', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-employee" className="font-semibold text-xs">Employee Details Paragraph</Label>
                <Textarea id="edit-employee" value={editableContent.employee} onChange={(e) => handleContentChange('employee', e.target.value)} rows={3} />
              </div>
               <div className="space-y-1">
                <Label htmlFor="edit-currentStatus" className="font-semibold text-xs">Current Status Paragraph</Label>
                <Textarea id="edit-currentStatus" value={editableContent.currentStatus} onChange={(e) => handleContentChange('currentStatus', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-purpose" className="font-semibold text-xs">Purpose Paragraph</Label>
                <Textarea id="edit-purpose" value={editableContent.purpose} onChange={(e) => handleContentChange('purpose', e.target.value)} rows={2} />
              </div>
            </div>
          ) : (
            <WorkCertificateDocument content={editableContent} property={property} />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">{t('buttons.close')}</Button></DialogClose>
          <Button onClick={handlePrint} disabled={isGenerating}>
            {isGenerating && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            <Icons.Download className="mr-2 h-4 w-4" />
            {t('buttons.download_pdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
