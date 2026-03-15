
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, type FieldValue, Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Property, LegalInformation, LoyaltyTierSetting } from '@/types/property';
import { timeZoneOptions, currencyOptions } from '@/types/property';
import { Icons } from '../icons';
import { generateInvoicePdf } from '@/lib/pdfGenerator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { addDays, format } from 'date-fns';
import type { Invoice } from '@/app/(app)/payments/page';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '../ui/separator';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Image from "next/image";
import { X, UploadCloud } from 'lucide-react';
import { Slider } from '../ui/slider';
import { uploadFile, deleteFile } from '@/lib/uploadHelper';
import type { Promotion } from '@/types/promotion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export default function BookingPageSettingsForm() {
  const { user, property, refreshUserProfile } = useAuth();
  const { t } = useTranslation('pages/settings/booking/content');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // Booking Page State
  const [primaryColor, setPrimaryColor] = useState("#003166");
  const [hoverColor, setHoverColor] = useState("#002a55");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [headerButtonText, setHeaderButtonText] = useState("");
  const [headerButtonLink, setHeaderButtonLink] = useState("");
  const [showPromoField, setShowPromoField] = useState(true);
  const [autoAssignRoom, setAutoAssignRoom] = useState(true);
  const [requirePhone, setRequirePhone] = useState(false);
  const [terms, setTerms] = useState("");
  const [defaultBookingStatus, setDefaultBookingStatus] = useState<'Confirmed' | 'Pending'>('Pending');
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [initialHeroImageUrl, setInitialHeroImageUrl] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [bookingLogoSize, setBookingLogoSize] = useState<number>(40);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  // Promo Card State
  const [promoCardEnabled, setPromoCardEnabled] = useState(false);
  const [promoCardDisplayType, setPromoCardDisplayType] = useState<'auto' | 'manual'>('auto');
  const [promoCardTitle, setPromoCardTitle] = useState("Save 10% when you book on our website!");
  const [promoCardDescription, setPromoCardDescription] = useState("Book direct to save 10% on all rooms and suites, and get free breakfast too.");
  const [promoCardPromotionId, setPromoCardPromotionId] = useState<string>('');
  const [promoCardImageFile, setPromoCardImageFile] = useState<File | null>(null);
  const [promoCardImagePreview, setPromoCardImagePreview] = useState<string | null>(null);
  const [initialPromoCardImageUrl, setInitialPromoCardImageUrl] = useState<string | null>(null);
  const promoCardInputRef = useRef<HTMLInputElement>(null);
  
  // New state for manual promo design
  const [promoCardManualImageFile, setPromoCardManualImageFile] = useState<File | null>(null);
  const [promoCardManualImagePreview, setPromoCardManualImagePreview] = useState<string | null>(null);
  const [initialPromoCardManualImageUrl, setInitialPromoCardManualImageUrl] = useState<string | null>(null);
  const promoCardManualInputRef = useRef<HTMLInputElement>(null);


  // Invoice Customization State
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [invoiceLogoFile, setInvoiceLogoFile] = useState<File | null>(null);
  const [invoiceLogoPreview, setInvoiceLogoPreview] = useState<string | null>(null);
  const [initialInvoiceLogoUrl, setInitialInvoiceLogoUrl] = useState<string | null>(null);
  const [invoicePrimaryColor, setInvoicePrimaryColor] = useState("#22c55e");
  const [invoiceFooterText, setInvoiceFooterText] = useState("");
  const [invoiceHeaderNotes, setInvoiceHeaderNotes] = useState("");
  const [includeAddressOnInvoice, setIncludeAddressOnInvoice] = useState(true);
  const [invoiceLogoSize, setInvoiceLogoSize] = useState<number>(25);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Stamp State
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [initialStampUrl, setInitialStampUrl] = useState<string | null>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const [stampSize, setStampSize] = useState<number>(25);


  // Preview Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);


  useEffect(() => {
    if (property) {
      const data = property;
      const settings = data.bookingPageSettings || {};
      setPrimaryColor(settings.primaryColor || "#003166");

      const hoverColorSetting = settings.primaryColorHover || "#002a55";
      setHoverColor(hoverColorSetting || "#002a55");
      
      setWelcomeMessage(settings.welcomeMessage || `Welcome to ${data.name}!`);
      setHeaderButtonText(settings.headerButtonText || "");
      setHeaderButtonLink(settings.headerButtonLink || "");
      setShowPromoField(settings.showPromoCodeField === undefined ? true : settings.showPromoCodeField);
      setAutoAssignRoom(settings.autoAssignRoom === undefined ? true : settings.autoAssignRoom);
      setRequirePhone(settings.requireGuestPhone || false);
      setTerms(settings.bookingTerms || "");
      setDefaultBookingStatus(settings.defaultBookingStatus || 'Pending');
      setHeroImagePreview(settings.heroImageUrl || null);
      setInitialHeroImageUrl(settings.heroImageUrl || null);
      setBookingLogoSize(settings.logoSize || 40);

      // Promo Card settings
      const promoCard = settings.promoCard || {};
      setPromoCardEnabled(promoCard.enabled || false);
      setPromoCardDisplayType(promoCard.displayType || 'auto');
      setPromoCardTitle(promoCard.title || "Save 10% when you book on our website!");
      setPromoCardDescription(promoCard.description || "Book direct to save 10% on all rooms and suites, and get free breakfast too.");
      setPromoCardPromotionId(promoCard.promotionId || '');
      setPromoCardImagePreview(promoCard.imageUrl || null);
      setInitialPromoCardImageUrl(promoCard.imageUrl || null);
      setPromoCardManualImagePreview(promoCard.manualDesignImageUrl || null);
      setInitialPromoCardManualImageUrl(promoCard.manualDesignImageUrl || null);

      const invoiceSettings = data.invoiceCustomization || {};
      setInvoicePrefix(invoiceSettings.prefix || "");
      setInvoicePrimaryColor(invoiceSettings.primaryColor || "#22c55e");
      setInvoiceFooterText(invoiceSettings.footerText || "");
      setInvoiceHeaderNotes(invoiceSettings.headerNotes || "");
      setIncludeAddressOnInvoice(invoiceSettings.includePropertyAddress === undefined ? true : invoiceSettings.includePropertyAddress);
      setInitialInvoiceLogoUrl(settings.logoUrl || null);
      setInvoiceLogoPreview(settings.logoUrl || null);
      setInvoiceLogoSize(invoiceSettings.logoSize || 25);
      setStampPreview(invoiceSettings.companyStampUrl || null);
      setInitialStampUrl(invoiceSettings.companyStampUrl || null);
      setStampSize(invoiceSettings.companyStampSize || 25);
    }
    setIsFetching(false);
  }, [property]);
  
  useEffect(() => {
    if (user?.propertyId) {
      const promoQuery = query(collection(db, 'promotions'), where('propertyId', '==', user.propertyId), where('active', '==', true));
      const unsub = onSnapshot(promoQuery, (snapshot) => {
        setPromotions(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Promotion)));
      });
      return () => unsub();
    }
  }, [user?.propertyId]);

  const handleLogoImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setInvoiceLogoFile(file);
      setInvoiceLogoPreview(URL.createObjectURL(file));
    }
  };

  const removeLogoImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setInvoiceLogoFile(null);
    setInvoiceLogoPreview(null);
    if (logoInputRef.current) {
        logoInputRef.current.value = "";
    }
  };
  
  const handleHeroImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setHeroImageFile(file);
      setHeroImagePreview(URL.createObjectURL(file));
    }
  };

  const removeHeroImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setHeroImageFile(null);
    setHeroImagePreview(null);
    if (heroInputRef.current) {
        heroInputRef.current.value = "";
    }
  };

  const handlePromoCardImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        setPromoCardImageFile(file);
        setPromoCardImagePreview(URL.createObjectURL(file));
    }
  };

  const removePromoCardImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPromoCardImageFile(null);
    setPromoCardImagePreview(null);
    if (promoCardInputRef.current) {
        promoCardInputRef.current.value = "";
    }
  };

  const handlePromoCardManualImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        setPromoCardManualImageFile(file);
        setPromoCardManualImagePreview(URL.createObjectURL(file));
    }
  };

  const removePromoCardManualImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPromoCardManualImageFile(null);
    setPromoCardManualImagePreview(null);
    if (promoCardManualInputRef.current) {
        promoCardManualInputRef.current.value = "";
    }
  };

  const handleStampChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setStampFile(file);
      setStampPreview(URL.createObjectURL(file));
    }
  };

  const removeStampImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setStampFile(null);
    setStampPreview(null);
    if (stampInputRef.current) {
      stampInputRef.current.value = "";
    }
  };

  const fileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
  });

  const handlePreviewInvoice = async () => {
    if (!user?.propertyId || !property) return;
    setIsGeneratingPreview(true);

    try {
        let logoDataUri: string | null = null;
        if (invoiceLogoFile) {
            logoDataUri = await fileToDataUri(invoiceLogoFile);
        } else if (invoiceLogoPreview) {
             const functions = getFunctions(app, 'europe-west1');
             const fetchImageProxy = httpsCallable(functions, 'fetchImageProxy');
             const result: any = await fetchImageProxy({ url: invoiceLogoPreview });
             logoDataUri = result.data.dataUri;
        }

        const samplePropertyData: Property = {
            ...property,
            currency: property.currency,
            invoiceCustomization: {
                prefix: invoicePrefix,
                logoUrl: logoDataUri || undefined,
                primaryColor: invoicePrimaryColor,
                footerText: invoiceFooterText,
                headerNotes: invoiceHeaderNotes,
                includePropertyAddress: includeAddressOnInvoice,
                logoSize: invoiceLogoSize,
                companyStampSize: stampSize,
            },
        };

        const sampleInvoice: Invoice = {
            id: 'PREVIEW-123',
            propertyId: property.id,
            invoiceNumber: `${invoicePrefix || 'INV'}-0001`,
            guestOrCompany: 'John Doe',
            dateIssued: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
            amount: 350.00,
            paymentStatus: 'Pending',
            lineItems: [
                { description: 'Standard Room - 2 nights', quantity: 2, unitPrice: 150.00, total: 300.00 },
                { description: 'Breakfast Service', quantity: 2, unitPrice: 25.00, total: 50.00 },
            ],
            notes: 'This is a preview invoice.',
            subtotal: 350.00,
            taxAmount: 35.00,
            discountAmount: 0,
        };
        
        const pdf = await generateInvoicePdf(sampleInvoice, samplePropertyData, null);
        const pdfDataUri = pdf.output('datauristring');
        setPreviewPdfUrl(pdfDataUri);
        setIsPreviewModalOpen(true);
    } catch(error) {
        console.error("Error generating invoice preview:", error);
        toast({ title: "Preview Error", description: t('toasts.preview_error'), variant: "destructive" });
    } finally {
        setIsGeneratingPreview(false);
    }
  };

  const handleSaveChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.propertyId) {
      toast({ title: "Error", description: t('toasts.error_property_not_found'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const propDocRef = doc(db, "properties", user.propertyId);
    
    try {
      let finalLogoUrl = initialInvoiceLogoUrl;
      if (invoiceLogoFile) {
        const pathPrefix = `properties/${user.propertyId}/logos`;
        finalLogoUrl = await uploadFile(pathPrefix, invoiceLogoFile);
        if (initialInvoiceLogoUrl && initialInvoiceLogoUrl !== finalLogoUrl) {
            await deleteFile(initialInvoiceLogoUrl).catch(e => console.warn("Old logo deletion failed, it might have been already removed.", e));
        }
      } else if (!invoiceLogoPreview && initialInvoiceLogoUrl) {
        await deleteFile(initialInvoiceLogoUrl).catch(e => console.warn("Old logo deletion failed.", e));
        finalLogoUrl = null;
      }
      
      let finalHeroUrl = initialHeroImageUrl;
      if (heroImageFile) {
        const pathPrefix = `properties/${user.propertyId}/hero`;
        finalHeroUrl = await uploadFile(pathPrefix, heroImageFile);
        if (initialHeroImageUrl && initialHeroImageUrl !== finalHeroUrl) {
            await deleteFile(initialHeroImageUrl).catch(e => console.warn("Old hero image deletion failed.", e));
        }
      } else if (!heroImagePreview && initialHeroImageUrl) {
        await deleteFile(initialHeroImageUrl).catch(e => console.warn("Old hero image deletion failed.", e));
        finalHeroUrl = null;
      }
      
      let finalPromoCardUrl = initialPromoCardImageUrl;
      if (promoCardImageFile) {
        const pathPrefix = `properties/${user.propertyId}/promo-card`;
        finalPromoCardUrl = await uploadFile(pathPrefix, promoCardImageFile);
        if (initialPromoCardImageUrl && initialPromoCardImageUrl !== finalPromoCardUrl) {
            await deleteFile(initialPromoCardImageUrl).catch(e => console.warn("Old promo card image deletion failed.", e));
        }
      } else if (!promoCardImagePreview && initialPromoCardImageUrl) {
        await deleteFile(initialPromoCardImageUrl).catch(e => console.warn("Old promo card image deletion failed.", e));
        finalPromoCardUrl = null;
      }

      let finalPromoCardManualUrl = initialPromoCardManualImageUrl;
      if (promoCardManualImageFile) {
        const pathPrefix = `properties/${user.propertyId}/promo-card-manual`;
        finalPromoCardManualUrl = await uploadFile(pathPrefix, promoCardManualImageFile);
        if (initialPromoCardManualImageUrl && initialPromoCardManualImageUrl !== finalPromoCardManualUrl) {
          await deleteFile(initialPromoCardManualImageUrl).catch(e => console.warn("Old manual promo image deletion failed.", e));
        }
      } else if (!promoCardManualImagePreview && initialPromoCardManualImageUrl) {
        await deleteFile(initialPromoCardManualImageUrl).catch(e => console.warn("Old manual promo image deletion failed.", e));
        finalPromoCardManualUrl = null;
      }
      
      let finalStampUrl = initialStampUrl;
      if (stampFile) {
        const pathPrefix = `properties/${user.propertyId}/stamps`;
        finalStampUrl = await uploadFile(pathPrefix, stampFile);
        if (initialStampUrl && finalStampUrl !== initialStampUrl) {
          await deleteFile(initialStampUrl).catch(e => console.warn("Old stamp deletion failed.", e));
        }
      } else if (!stampPreview && initialStampUrl) {
        await deleteFile(initialStampUrl).catch(e => console.warn("Old stamp deletion failed.", e));
        finalStampUrl = null;
      }

      const finalHoverColor = hoverColor;
      
      const settingsPayload = {
        'bookingPageSettings.primaryColor': primaryColor,
        'bookingPageSettings.primaryColorHover': finalHoverColor,
        'bookingPageSettings.welcomeMessage': welcomeMessage,
        'bookingPageSettings.headerButtonText': headerButtonText,
        'bookingPageSettings.headerButtonLink': headerButtonLink,
        'bookingPageSettings.showPromoCodeField': showPromoField,
        'bookingPageSettings.autoAssignRoom': autoAssignRoom,
        'bookingPageSettings.requireGuestPhone': requirePhone,
        'bookingPageSettings.bookingTerms': terms,
        'bookingPageSettings.defaultBookingStatus': defaultBookingStatus,
        'bookingPageSettings.logoUrl': finalLogoUrl,
        'bookingPageSettings.heroImageUrl': finalHeroUrl,
        'bookingPageSettings.logoSize': bookingLogoSize,
        'bookingPageSettings.promoCard': {
            enabled: promoCardEnabled,
            displayType: promoCardDisplayType,
            title: promoCardTitle,
            description: promoCardDescription,
            imageUrl: finalPromoCardUrl,
            promotionId: promoCardPromotionId === 'none' ? '' : promoCardPromotionId,
            manualDesignImageUrl: finalPromoCardManualUrl,
        },
        'invoiceCustomization.prefix': invoicePrefix,
        'invoiceCustomization.logoUrl': finalLogoUrl,
        'invoiceCustomization.primaryColor': invoicePrimaryColor,
        'invoiceCustomization.footerText': invoiceFooterText,
        'invoiceCustomization.headerNotes': invoiceHeaderNotes,
        'invoiceCustomization.includePropertyAddress': includeAddressOnInvoice,
        'invoiceCustomization.logoSize': invoiceLogoSize,
        'invoiceCustomization.companyStampUrl': finalStampUrl,
        'invoiceCustomization.companyStampSize': stampSize,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(propDocRef, settingsPayload);
      toast({ title: "Success", description: t('toasts.success_save') });
      await refreshUserProfile();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error", description: t('toasts.error_save'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveChanges}>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('form.title')}</CardTitle>
          <CardDescription>
            {t('form.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="appearance" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="appearance">{t('form.tabs.appearance')}</TabsTrigger>
              <TabsTrigger value="behavior">{t('form.tabs.behavior')}</TabsTrigger>
              <TabsTrigger value="invoice">{t('form.tabs.invoice')}</TabsTrigger>
            </TabsList>

            <TabsContent value="appearance" className="mt-6">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">{t('form.appearance_section.title')}</h3>
                  <div className="space-y-1">
                    <Label htmlFor="heroImageUpload">{t('form.appearance_section.hero_image_label')}</Label>
                    <div className="mt-1 flex justify-center items-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary w-full" onClick={() => heroInputRef.current?.click()}>
                        <div className="space-y-1 text-center w-full h-full relative">
                        {heroImagePreview ? (
                            <div className="relative group w-full h-32 mx-auto">
                                <Image src={heroImagePreview} alt="Hero preview" fill style={{ objectFit: "cover" }} className="rounded-md"/>
                                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={removeHeroImage}> <X className="h-4 w-4"/> </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground mt-1">{t('form.appearance_section.hero_image_upload_text')}</p>
                            </div>
                        )}
                        </div>
                        <Input ref={heroInputRef} id="heroImageUpload" type="file" className="sr-only" onChange={handleHeroImageChange} accept="image/png, image/jpeg, image/webp" />
                    </div>
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="logoUpload">{t('form.appearance_section.logo_label')}</Label>
                       <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary" onClick={() => logoInputRef.current?.click()}>
                          <div className="space-y-1 text-center">
                            {invoiceLogoPreview ? (
                              <div className="relative group w-32 h-24 mx-auto">
                                  <Image src={invoiceLogoPreview} alt="Logo preview" fill style={{ objectFit: "contain" }} className="rounded-md"/>
                                  <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={removeLogoImage}> <X className="h-4 w-4"/> </Button>
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">{t('form.appearance_section.logo_upload_text')}</p>
                              </>
                            )}
                          </div>
                          <Input ref={logoInputRef} id="logoUpload" type="file" className="sr-only" onChange={handleLogoImageChange} accept="image/png, image/jpeg, image/webp" />
                      </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bookingLogoSize">{t('form.appearance_section.booking_logo_size_label')} ({bookingLogoSize}px)</Label>
                    <Slider
                      id="bookingLogoSize"
                      min={20}
                      max={100}
                      step={2}
                      value={[bookingLogoSize]}
                      onValueChange={(value) => setBookingLogoSize(value[0])}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="primaryColor">{t('form.appearance_section.primary_color_label')}</Label>
                        <div className="flex items-center gap-2">
                            <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="p-1 h-10 w-14"/>
                            <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#003166" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="primaryColorHover">{t('form.appearance_section.hover_color_label')}</Label>
                         <div className="flex items-center gap-2">
                            <Input id="primaryColorHoverColor" type="color" value={hoverColor} onChange={(e) => setHoverColor(e.target.value)} className="p-1 h-10 w-14"/>
                            <Input value={hoverColor} onChange={(e) => setHoverColor(e.target.value)} placeholder="#002a55" />
                        </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                        <Label htmlFor="welcomeMessage">{t('form.appearance_section.welcome_message_label')}</Label>
                        <Input id="welcomeMessage" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder={t('form.appearance_section.welcome_message_placeholder')} />
                  </div>
                  <div className="md:col-span-2"><Separator /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="headerButtonText">{t('form.appearance_section.button_text_label')}</Label>
                            <Input id="headerButtonText" value={headerButtonText} onChange={(e) => setHeaderButtonText(e.target.value)} placeholder={t('form.appearance_section.button_text_placeholder')} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="headerButtonLink">{t('form.appearance_section.button_link_label')}</Label>
                            <Input id="headerButtonLink" value={headerButtonLink} onChange={(e) => setHeaderButtonLink(e.target.value)} placeholder={t('form.appearance_section.button_link_placeholder')} />
                        </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="behavior" className="mt-6">
                <div className="space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-foreground">{t('form.behavior_section.title')}</h3>
                        <div className="space-y-2 pt-2">
                            <Label>{t('form.behavior_section.default_status_label')}</Label>
                            <RadioGroup value={defaultBookingStatus} onValueChange={(v) => setDefaultBookingStatus(v as any)} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Pending" id="status-pending" />
                                    <Label htmlFor="status-pending" className="font-normal cursor-pointer">{t('form.behavior_section.status_pending')}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="Confirmed" id="status-confirmed" />
                                    <Label htmlFor="status-confirmed" className="font-normal cursor-pointer">{t('form.behavior_section.status_confirmed')}</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <Switch id="showPromoField" checked={showPromoField} onCheckedChange={setShowPromoField} />
                                <Label htmlFor="showPromoField">{t('form.behavior_section.promo_field_label')}</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="autoAssignRoom" checked={autoAssignRoom} onCheckedChange={setAutoAssignRoom} />
                                <Label htmlFor="autoAssignRoom">{t('form.behavior_section.auto_assign_label')}</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="requirePhone" checked={requirePhone} onCheckedChange={setRequirePhone} />
                                <Label htmlFor="requirePhone">{t('form.behavior_section.require_phone_label')}</Label>
                            </div>
                        </div>
                        <div className="space-y-1 pt-2">
                            <Label htmlFor="terms">{t('form.behavior_section.terms_label')}</Label>
                            <Textarea id="terms" value={terms} onChange={e => setTerms(e.target.value)} placeholder={t('form.behavior_section.terms_placeholder')} rows={6} />
                        </div>
                    </div>
                    <div className="space-y-4 pt-6 border-t">
                        <h3 className="text-lg font-medium text-foreground">{t('form.promo_card_section.title')}</h3>
                        <div className="flex items-center space-x-2">
                            <Switch id="promoCardEnabled" checked={promoCardEnabled} onCheckedChange={setPromoCardEnabled} />
                            <Label htmlFor="promoCardEnabled">{t('form.promo_card_section.enable_label')}</Label>
                        </div>
                        {promoCardEnabled && (
                            <div className="space-y-4 pt-2 animate-in fade-in-50">
                                <div className="space-y-2">
                                    <Label>{t('form.promo_card_section.display_type_label')}</Label>
                                    <RadioGroup value={promoCardDisplayType} onValueChange={(v) => setPromoCardDisplayType(v as any)} className="flex gap-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="auto" id="display-auto" />
                                            <Label htmlFor="display-auto" className="font-normal cursor-pointer">{t('form.promo_card_section.display_type_auto')}</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="manual" id="display-manual" />
                                            <Label htmlFor="display-manual" className="font-normal cursor-pointer">{t('form.promo_card_section.display_type_manual')}</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {promoCardDisplayType === 'auto' && (
                                  <div className="space-y-4 p-4 border rounded-lg animate-in fade-in-50">
                                    <div className="space-y-1">
                                        <Label htmlFor="promoCardTitle">{t('form.promo_card_section.title_label')}</Label>
                                        <Input id="promoCardTitle" value={promoCardTitle} onChange={e => setPromoCardTitle(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="promoCardDescription">{t('form.promo_card_section.description_label')}</Label>
                                        <Textarea id="promoCardDescription" value={promoCardDescription} onChange={e => setPromoCardDescription(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="promoCardPromotionId">{t('form.promo_card_section.promotion_label')}</Label>
                                        <Select value={promoCardPromotionId} onValueChange={(v) => setPromoCardPromotionId(v === 'none' ? '' : v)}>
                                            <SelectTrigger><SelectValue placeholder={t('form.promo_card_section.promotion_placeholder')} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">{t('form.promo_card_section.promotion_none')}</SelectItem>
                                                {promotions.filter(p => p.couponCode).map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.couponCode})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="promoCardImage">{t('form.promo_card_section.image_label')}</Label>
                                        <div className="mt-1 flex justify-center items-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary aspect-video" onClick={() => promoCardInputRef.current?.click()}>
                                            <div className="space-y-1 text-center w-full h-full relative">
                                                {promoCardImagePreview ? (
                                                    <div className="relative group w-full h-full">
                                                        <Image src={promoCardImagePreview} alt="Promo Card preview" fill style={{ objectFit: "cover" }} className="rounded-md" />
                                                        <Button variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7 opacity-0 group-hover:opacity-100 z-10" onClick={removePromoCardImage}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full">
                                                        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                                        <p className="text-sm text-muted-foreground">{t('form.promo_card_section.image_upload_text')}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <Input ref={promoCardInputRef} id="promoCardImage" type="file" className="sr-only" onChange={handlePromoCardImageChange} accept="image/png, image/jpeg, image/webp" />
                                        </div>
                                    </div>
                                  </div>
                                )}
                                {promoCardDisplayType === 'manual' && (
                                  <div className="space-y-1 p-4 border rounded-lg animate-in fade-in-50">
                                      <Label htmlFor="promoCardManualImage">{t('form.promo_card_section.manual_design_label')}</Label>
                                      <div className="mt-1 flex justify-center items-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary aspect-video" onClick={() => promoCardManualInputRef.current?.click()}>
                                          <div className="space-y-1 text-center w-full h-full relative">
                                              {promoCardManualImagePreview ? (
                                                  <div className="relative group w-full h-full">
                                                      <Image src={promoCardManualImagePreview} alt="Manual promo design preview" fill style={{ objectFit: "cover" }} className="rounded-md" />
                                                      <Button variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7 opacity-0 group-hover:opacity-100 z-10" onClick={removePromoCardManualImage}><X className="h-4 w-4" /></Button>
                                                  </div>
                                              ) : (
                                                  <div className="flex flex-col items-center justify-center h-full">
                                                      <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                                      <p className="text-sm text-muted-foreground">{t('form.promo_card_section.manual_design_upload_text')}</p>
                                                  </div>
                                              )}
                                          </div>
                                          <Input ref={promoCardManualInputRef} id="promoCardManualImage" type="file" className="sr-only" onChange={handlePromoCardManualImageChange} accept="image/png, image/jpeg, image/webp" />
                                      </div>
                                      <p className="text-xs text-muted-foreground">{t('form.promo_card_section.manual_design_description')}</p>
                                  </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </TabsContent>
            
            <TabsContent value="invoice" className="mt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1">
                      <Label htmlFor="invoicePrefix">{t('form.invoice_section.prefix_label')}</Label>
                      <Input id="invoicePrefix" value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} placeholder={t('form.invoice_section.prefix_placeholder')} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="invoicePrimaryColor">{t('form.invoice_section.color_label')}</Label>
                    <div className="flex items-center gap-2">
                        <Input id="invoicePrimaryColor" type="color" value={invoicePrimaryColor} onChange={(e) => setInvoicePrimaryColor(e.target.value)} className="p-1 h-10 w-14"/>
                        <Input value={invoicePrimaryColor} onChange={(e) => setInvoicePrimaryColor(e.target.value)} placeholder="#22c55e" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="invoiceLogoSize">{t('form.invoice_section.logo_size_label')} ({invoiceLogoSize}px)</Label>
                    <Slider
                      id="invoiceLogoSize"
                      min={10}
                      max={50}
                      step={1}
                      value={[invoiceLogoSize]}
                      onValueChange={(value) => setInvoiceLogoSize(value[0])}
                    />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">{t('form.invoice_section.stamp_label')}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label="More info"><Icons.HelpCircle className="h-4 w-4 text-muted-foreground" /></button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('form.invoice_section.stamp_tooltip')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                   <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary" onClick={() => stampInputRef.current?.click()}>
                      <div className="space-y-1 text-center">
                        {stampPreview ? (
                          <div className="relative group w-32 h-24 mx-auto">
                              <Image src={stampPreview} alt="Stamp preview" fill style={{ objectFit: "contain" }} className="rounded-md"/>
                              <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={removeStampImage}> <X className="h-4 w-4"/> </Button>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{t('form.appearance_section.logo_upload_text')}</p>
                          </>
                        )}
                      </div>
                      <Input ref={stampInputRef} id="stampUpload" type="file" className="sr-only" onChange={handleStampChange} accept="image/png" />
                  </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="stampSize">{t('form.invoice_section.stamp_size_label')} ({stampSize}px)</Label>
                    <Slider
                      id="stampSize"
                      min={15}
                      max={150}
                      step={1}
                      value={[stampSize]}
                      onValueChange={(value) => setStampSize(value[0])}
                    />
                </div>
                <div className="grid grid-cols-1 gap-4">
                   <div className="space-y-2">
                        <Label htmlFor="invoiceHeaderNotes">{t('form.invoice_section.header_notes_label')}</Label>
                        <Input id="invoiceHeaderNotes" value={invoiceHeaderNotes} onChange={e => setInvoiceHeaderNotes(e.target.value)} placeholder={t('form.invoice_section.header_notes_placeholder')} />
                   </div>
                   <div className="space-y-1">
                      <Label htmlFor="invoiceFooterText">{t('form.invoice_section.footer_text_label')}</Label>
                      <Textarea id="invoiceFooterText" value={invoiceFooterText} onChange={e => setInvoiceFooterText(e.target.value)} placeholder={t('form.invoice_section.footer_text_placeholder')} rows={3} />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                      <Switch id="includeAddressOnInvoice" checked={includeAddressOnInvoice} onCheckedChange={setIncludeAddressOnInvoice} />
                      <Label htmlFor="includeAddressOnInvoice">{t('form.invoice_section.include_address_label')}</Label>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center gap-2 pt-6 border-t">
          <Button type="submit" disabled={isLoading || isFetching}>
            {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            {t('buttons.save')}
          </Button>
          <div className="flex gap-2">
            {property?.slug && (
              <Button asChild variant="secondary">
                <Link href={`/booking/${property.slug}`} target="_blank">
                  <Icons.Eye className="mr-2 h-4 w-4" />
                  {t('buttons.preview_booking_page')}
                </Link>
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={handlePreviewInvoice} disabled={isGeneratingPreview}>
              {isGeneratingPreview ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" /> : <Icons.Eye className="mr-2 h-4 w-4" />}
              {t('buttons.preview_invoice')}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{t('preview_modal.title')}</DialogTitle>
                <DialogDescription>
                    {t('preview_modal.description')}
                </DialogDescription>
            </DialogHeader>
            <div className="flex-grow w-full mt-4">
                {previewPdfUrl ? (
                    <iframe src={previewPdfUrl} className="w-full h-full border rounded-md" title="Invoice Preview" />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">{t('preview_modal.loading')}</p>
                    </div>
                )}
            </div>
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">{t('preview_modal.close')}</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
