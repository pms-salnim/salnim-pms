
"use client";

import React, { useState, useEffect } from 'react';
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
import { enUS, fr } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import type { Property } from '@/types/property';
import { generateInternshipCertificatePdf } from '@/lib/internshipCertificateGenerator';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Textarea } from '../ui/textarea';
import i18n from '@/lib/i18n';
import { staffDepartments } from '@/types/staff';


interface InternshipCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
}

const InternshipCertificateDocument = React.forwardRef<HTMLDivElement, { content: Record<string, string>, property: Property; }>(({ content, property }, ref) => {
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
InternshipCertificateDocument.displayName = 'InternshipCertificateDocument';


export default function InternshipCertificateModal({ isOpen, onClose, staffMember }: InternshipCertificateModalProps) {
  const { property } = useAuth();
  const [language, setLanguage] = useState<'en' | 'fr'>('fr');
  const [isGenerating, setIsGenerating] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: new Date()});
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  
  const { t, i18n: i18nInstance } = useTranslation('pages/staff/management');
  const currentLocale = i18nInstance.language === 'fr' ? fr : enUS;

  const generateContent = (lang: 'en' | 'fr', staff: StaffMember, prop: Property | null, startDateValue?: Date, endDateValue?: Date) => {
    const today = new Date();
    const legalInfo = prop?.legalInformation || {};
    const tDoc = i18n.getFixedT(lang, 'pages/staff/management');
    
    const dynamicData = {
        companyName: (legalInfo.companyName || prop?.name || '').toUpperCase(),
        fullName: (staff.fullName).toUpperCase(),
        cin: (staff.cin || 'N/A').toUpperCase(),
        address: (staff.address || '').toUpperCase(),
        role: tDoc(`positions.${staff.role}`),
        department: staff.department ? tDoc(staffDepartments[staff.department as keyof typeof staffDepartments].labelKey) : 'N/A',
        startDate: (startDateValue ? startDateValue.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A').toUpperCase(),
        endDate: (endDateValue ? endDateValue.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A').toUpperCase(),
    };

    const contentTemplates = {
        en: {
            title: "INTERNSHIP CERTIFICATE",
            certify: `We, the undersigned, ${dynamicData.companyName}, certify that:`,
            employee: `Mr./Ms. ${dynamicData.fullName}, holder of CIN No. ${dynamicData.cin}, residing at ${dynamicData.address}, completed an internship within our establishment from ${dynamicData.startDate} to ${dynamicData.endDate}, in the ${dynamicData.department} department, as a/an ${dynamicData.role}.`,
            purpose: "This certificate is issued to serve for all legal purposes.",
            issuedAt: `Issued in ${prop?.city || 'not specified'}, on ${today.toLocaleDateString('en-US')}`,
            signature: "Signature and Stamp of the Company"
        },
        fr: {
            title: "ATTESTATION DE STAGE",
            certify: `Nous soussignés, ${dynamicData.companyName}, attestons que :`,
            employee: `M./Mme ${dynamicData.fullName}, titulaire de la CIN n° ${dynamicData.cin}, demeurant à ${dynamicData.address}, a effectué un stage au sein de notre établissement du ${dynamicData.startDate} au ${dynamicData.endDate}, au sein du service ${dynamicData.department}, en qualité de ${dynamicData.role}.`,
            purpose: "Cette attestation est délivrée pour servir et valoir ce que de droit.",
            issuedAt: `Fait à ${prop?.city || 'non précisé'}, le ${today.toLocaleDateString('fr-FR')}`,
            signature: "Signature et cachet de l’entreprise"
        }
    };
    return { ...contentTemplates[lang], ...dynamicData };
  };

  useEffect(() => {
    if (staffMember && property) {
        setEditableContent(generateContent(language, staffMember, property, dateRange?.from, dateRange?.to));
    }
  }, [staffMember, property, language, dateRange]);

  const handlePrint = async () => {
    if (!staffMember || !property) {
      toast({ title: "Error", description: "Missing required data to generate PDF.", variant: "destructive" });
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
        toast({ title: t('internship_certificate_modal.date_range_required_title'), description: t('internship_certificate_modal.date_range_required_description'), variant: "destructive" });
        return;
    }
    setIsGenerating(true);
    try {
      const pdf = await generateInternshipCertificatePdf(editableContent, property);
      pdf.save(`attestation-de-stage-${staffMember.fullName.replace(/\s/g, '-')}.pdf`);
    } catch (error) {
      console.error("Error generating internship certificate PDF:", error);
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
          <DialogTitle>{t('internship_certificate_modal.title', { name: staffMember.fullName })}</DialogTitle>
          <DialogDescription>{t('internship_certificate_modal.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                 <div className="space-y-1">
                    <Label htmlFor="internshipDateRange" className="font-medium">{t('internship_certificate_modal.date_range_label')} <span className="text-destructive">*</span></Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="internshipDateRange"
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "PPP", { locale: currentLocale })} - {format(dateRange.to, "PPP", { locale: currentLocale })}</> : format(dateRange.from, "PPP", { locale: currentLocale })) : <span>{t('form.date_placeholder')}</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus locale={currentLocale} /></PopoverContent>
                    </Popover>
                </div>
                <div className="flex items-center gap-2 self-end">
                    <Label className="text-sm font-medium">{t('internship_certificate_modal.language_label')}</Label>
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
                      <Label htmlFor="edit-certify-internship" className="font-semibold text-xs">Certify Paragraph</Label>
                      <Textarea id="edit-certify-internship" value={editableContent.certify} onChange={(e) => handleContentChange('certify', e.target.value)} rows={2} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-employee-internship" className="font-semibold text-xs">Employee Details Paragraph</Label>
                      <Textarea id="edit-employee-internship" value={editableContent.employee} onChange={(e) => handleContentChange('employee', e.target.value)} rows={3} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-purpose-internship" className="font-semibold text-xs">Purpose Paragraph</Label>
                      <Textarea id="edit-purpose-internship" value={editableContent.purpose} onChange={(e) => handleContentChange('purpose', e.target.value)} rows={2} />
                    </div>
                  </div>
              ) : (
                (dateRange?.from && dateRange?.to && editableContent.certify) ? <InternshipCertificateDocument content={editableContent} property={property} /> : <div className="p-10 text-center text-muted-foreground">{t('internship_certificate_modal.select_dates_prompt')}</div>
              )}
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">{t('buttons.close')}</Button></DialogClose>
          <Button onClick={handlePrint} disabled={isGenerating || !dateRange?.from || !dateRange.to}>
            {isGenerating && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            <Icons.Download className="mr-2 h-4 w-4" />
            {t('buttons.download_pdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
