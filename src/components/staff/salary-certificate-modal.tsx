
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icons } from "@/components/icons";
import type { StaffMember } from '@/types/staff';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { format, subMonths } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import type { Property } from '@/types/property';
import { toWordsFr } from '@/lib/i18n-fr';
import { generateSalaryCertificatePdf } from '@/lib/salaryCertificateGenerator';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import i18n from '@/lib/i18n';

// This is the printable component for display within the modal
const SalaryCertificateDocument = React.forwardRef<HTMLDivElement, { content: Record<string, string>, property: Property | null }>(({ content, property }, ref) => {
    const legalInfo = property?.legalInformation || {};
    const legalDetails = [
        legalInfo.rcNumber && `RC: ${legalInfo.rcNumber}`,
        legalInfo.iceNumber && `ICE: ${legalInfo.iceNumber}`,
        legalInfo.ifNumber && `IF: ${legalInfo.ifNumber}`,
        legalInfo.patenteNumber && `CNSS: ${legalInfo.patenteNumber}`,
        legalInfo.tvaInfo && `TVA: ${legalInfo.tvaInfo}`,
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
                <p className="font-bold">{content.object}</p>
                
                <p dangerouslySetInnerHTML={{ __html: (content.certify || '').replace(/\n/g, '<br/>') }} />
                <p className="pl-4" dangerouslySetInnerHTML={{ __html: (content.employee || '').replace(/\n/g, '<br/>') }} />
                <p className="pl-4" dangerouslySetInnerHTML={{ __html: (content.grossSalary || '').replace(/\n/g, '<br/>') }} />
                <p className="pl-4" dangerouslySetInnerHTML={{ __html: (content.netSalary || '').replace(/\n/g, '<br/>') }} />
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
SalaryCertificateDocument.displayName = 'SalaryCertificateDocument';


interface SalaryCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
}

export default function SalaryCertificateModal({ isOpen, onClose, staffMember }: SalaryCertificateModalProps) {
  const { property } = useAuth();
  const [language, setLanguage] = useState<'en' | 'fr'>('fr');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});

  const { t, i18n: i18nInstance } = useTranslation('pages/staff/management');
  const currentLocale = i18nInstance.language === 'fr' ? fr : enUS;

  const generateContent = (lang: 'en' | 'fr', month: string, staff: StaffMember, prop: Property | null) => {
    const today = new Date();
    const legalInfo = prop?.legalInformation || {};
    const netSalary = (staff.salary || 0) * 0.8; // Example calculation
    const salaryInWords = toWordsFr(staff.salary || 0);
    const tDoc = i18n.getFixedT(lang, 'pages/staff/management');
    
    const dynamicData = {
        companyName: (legalInfo.companyName || prop?.name || ''),
        fullName: staff.fullName,
        cin: staff.cin || 'N/A',
        address: staff.address || '',
        role: tDoc(`positions.${staff.role}`),
        hireDate: (staff.hireDate ? new Date(staff.hireDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'),
        salary: (staff.salary ? staff.salary.toFixed(2) : 'N/A'),
        netSalary: netSalary.toFixed(2),
        selectedMonth: month,
        salaryInWords: salaryInWords,
    };

    const contentTemplates = {
        en: {
            title: "SALARY CERTIFICATE",
            object: "Object: Salary Certificate",
            certify: `We, the undersigned, <b>${dynamicData.companyName}</b>, hereby certify that:`,
            employee: `Mr./Ms. <b>${dynamicData.fullName}</b>, holder of CIN No. <b>${dynamicData.cin}</b>, residing at <b>${dynamicData.address}</b>, is employed in our establishment as a <b>${dynamicData.role}</b> since <b>${dynamicData.hireDate}</b>.`,
            grossSalary: `The gross monthly salary of the concerned for the month of <b>${dynamicData.selectedMonth}</b> amounts to <b>${dynamicData.salary} MAD</b>.`,
            netSalary: `The net salary received is <b>${dynamicData.netSalary} ${prop?.currency || 'MAD'}</b>.`,
            purpose: "This certificate is issued at the request of the employee to serve for all legal purposes.",
            issuedAt: `Issued in ${prop?.city || 'not specified'}, on ${today.toLocaleDateString('en-US')}`,
            signature: "Signature and Stamp of the Company"
        },
        fr: {
            title: "ATTESTATION DE SALAIRE",
            object: "Objet : Attestation de Salaire",
            certify: `Nous soussignés, <b>${dynamicData.companyName}</b>, certifions par la présente que :`,
            employee: `M./Mme <b>${dynamicData.fullName}</b>, titulaire de la CIN n° <b>${dynamicData.cin}</b>, demeurant à <b>${dynamicData.address}</b>, est employé(e) au sein de notre établissement en qualité de <b>${dynamicData.role}</b> depuis le <b>${dynamicData.hireDate}</b>.`,
            grossSalary: `Le salaire mensuel brut de l’intéressé(e) pour le mois de <b>${dynamicData.selectedMonth}</b> s’élève à <b>${dynamicData.salary} MAD</b> (soit <b>${dynamicData.salaryInWords}</b> dirhams) par mois.`,
            netSalary: `Le salaire net perçu est de <b>${dynamicData.netSalary} ${prop?.currency || 'MAD'}</b>.`,
            purpose: "La présente attestation est délivrée à la demande de l’intéressé(e) pour servir et valoir ce que de droit.",
            issuedAt: `Fait à ${prop?.city || 'non précisé'}, le ${today.toLocaleDateString('fr-FR')}`,
            signature: "Signature et cachet de l’entreprise"
        }
    };
    return { ...contentTemplates[lang], ...dynamicData };
  };
  
  useEffect(() => {
    const now = new Date();
    const monthsArray = Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(now, i);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: currentLocale });
      return { value, label };
    });
    setMonths(monthsArray);
    if (!selectedMonth) {
        setSelectedMonth(monthsArray[0].value);
    }
  }, [currentLocale, selectedMonth]);

  useEffect(() => {
    if (staffMember && property && selectedMonth) {
        const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
        setEditableContent(generateContent(language, selectedMonthLabel, staffMember, property));
    }
  }, [staffMember, property, selectedMonth, language, months]);

  const handlePrint = async () => {
    if (!staffMember || !property) {
      toast({ title: "Error", description: "Missing required data to generate PDF.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const pdf = await generateSalaryCertificatePdf(editableContent, property);
      pdf.save(`attestation-de-salaire-${staffMember.fullName.replace(/\s/g, '-')}.pdf`);
    } catch (error) {
      console.error("Error generating salary certificate PDF:", error);
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
          <DialogTitle>{t('salary_certificate_modal.title', { name: staffMember.fullName })}</DialogTitle>
          <DialogDescription>{t('salary_certificate_modal.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-between items-center gap-2 -mt-2">
            <div className="flex-grow">
                <Label htmlFor="month-select" className="text-xs font-medium">{t('salary_certificate_modal.month_label')}</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month-select" className="w-full sm:w-[220px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {months.map(month => (
                            <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2 self-end">
                <Label className="text-sm font-medium">{t('salary_certificate_modal.language_label')}</Label>
                <Button variant={language === 'en' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('en')}>English</Button>
                <Button variant={language === 'fr' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('fr')}>Français</Button>
            </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Icons.Edit className="h-4 w-4 mr-2"/>
            {isEditing ? t('buttons.preview_document') : t('buttons.edit_document')}
          </Button>
        </div>

        <div className="border rounded-md bg-gray-100 max-h-[50vh] overflow-auto">
          {isEditing ? (
            <div className="p-4 space-y-3 bg-white">
              <div className="space-y-1">
                <Label htmlFor="edit-certify" className="font-semibold text-xs">{t('salary_certificate_modal.certify_paragraph_label')}</Label>
                <Textarea id="edit-certify" value={editableContent.certify || ''} onChange={(e) => handleContentChange('certify', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-employee" className="font-semibold text-xs">{t('salary_certificate_modal.employee_details_paragraph_label')}</Label>
                <Textarea id="edit-employee" value={editableContent.employee || ''} onChange={(e) => handleContentChange('employee', e.target.value)} rows={3} />
              </div>
               <div className="space-y-1">
                <Label htmlFor="edit-grossSalary" className="font-semibold text-xs">{t('salary_certificate_modal.gross_salary_paragraph_label')}</Label>
                <Textarea id="edit-grossSalary" value={editableContent.grossSalary || ''} onChange={(e) => handleContentChange('grossSalary', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-netSalary" className="font-semibold text-xs">{t('salary_certificate_modal.net_salary_paragraph_label')}</Label>
                <Textarea id="edit-netSalary" value={editableContent.netSalary || ''} onChange={(e) => handleContentChange('netSalary', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-purpose" className="font-semibold text-xs">{t('salary_certificate_modal.purpose_paragraph_label')}</Label>
                <Textarea id="edit-purpose" value={editableContent.purpose || ''} onChange={(e) => handleContentChange('purpose', e.target.value)} rows={2} />
              </div>
            </div>
          ) : (
            <SalaryCertificateDocument content={editableContent} property={property} />
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
