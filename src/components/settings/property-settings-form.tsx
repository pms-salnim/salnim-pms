
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

export default function PropertySettingsForm() {
  const { user, property, refreshUserProfile } = useAuth();
  const { t } = useTranslation('pages/settings/property/content');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [formData, setFormData] = useState<Partial<Property>>({});
  const [taxSettings, setTaxSettings] = useState({ enabled: true, name: '', rate: 0 });
  const [loyaltySettings, setLoyaltySettings] = useState({ enabled: false, earningRate: 1, redemptionRate: 0.01, tiers: [] as LoyaltyTierSetting[] });
  const [legalInformation, setLegalInformation] = useState<LegalInformation>({});
  const [bookingPageSettings, setBookingPageSettings] = useState<Property['bookingPageSettings']>({});


  const currencySymbol = currencyOptions.find(c => c.value === formData.currency)?.symbol || '$';


  useEffect(() => {
    if (property) {
      const data = property;
      const settings = data.bookingPageSettings || {};
      setFormData({
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        legalName: data.legalName,
        defaultCheckInTime: data.defaultCheckInTime,
        defaultCheckOutTime: data.defaultCheckOutTime,
        cancellationPolicy: data.cancellationPolicy,
        timeZone: data.timeZone,
        currency: data.currency,
        aboutUs: data.aboutUs,
      });
      setTaxSettings(data.taxSettings || { enabled: true, name: '', rate: 0 });
      setLoyaltySettings(data.loyaltyProgramSettings || { enabled: false, earningRate: 1, redemptionRate: 0.01, tiers: [] });
      setLegalInformation(data.legalInformation || {});
      setBookingPageSettings(settings);
    }
    setIsFetching(false);
  }, [property]);

  const handleFormChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTaxChange = (field: keyof typeof taxSettings, value: any) => {
    setTaxSettings(prev => ({ ...prev, [field]: value }));
  };
  
  const handleLoyaltyChange = (field: keyof typeof loyaltySettings, value: any) => {
    setLoyaltySettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLegalInfoChange = (field: keyof LegalInformation, value: string) => {
    setLegalInformation(prev => ({ ...prev, [field]: value }));
  };
  
  const handleBookingSettingsChange = (field: keyof Property['bookingPageSettings'], value: any) => {
    setBookingPageSettings(prev => ({ ...prev, [field]: value }));
  };
  
  const handleTierChange = (index: number, field: keyof LoyaltyTierSetting, value: string | number) => {
      const updatedTiers = [...(loyaltySettings.tiers || [])];
      while (updatedTiers.length <= index) {
          updatedTiers.push({ name: '', minPoints: 0 });
      }
      
      if (typeof updatedTiers[index] === 'object') {
        if (field === 'minPoints') {
            updatedTiers[index] = { ...updatedTiers[index], [field]: Number(value) };
        } else {
            updatedTiers[index] = { ...updatedTiers[index], [field]: value as string };
        }
        setLoyaltySettings(prev => ({ ...prev, tiers: updatedTiers }));
      }
  };

  const handleSaveChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!property?.id) {
      toast({ title: "Error", description: t('toasts.error_property_not_found'), variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const cleanedFormData = { ...formData };
    Object.keys(cleanedFormData).forEach(key => {
        if (cleanedFormData[key as keyof typeof cleanedFormData] === undefined) {
            cleanedFormData[key as keyof typeof cleanedFormData] = null as any;
        }
    });

    const dataToUpdate = {
        ...cleanedFormData,
        taxSettings,
        loyaltyProgramSettings: {
            ...loyaltySettings,
            tiers: loyaltySettings.tiers?.map((t, index) => ({
                name: t.name || defaultTierNames[index],
                minPoints: Number(t.minPoints) || 0
            })) || [],
        },
        legalInformation,
        bookingPageSettings: {
            ...property.bookingPageSettings,
            ...bookingPageSettings
        },
    };

    try {
      const functions = getFunctions(app);
      const updatePropertyFunction = httpsCallable(functions, 'updateProperty');

      const result = await updatePropertyFunction({
        propertyId: property.id,
        updates: dataToUpdate
      });

      const response = result.data as { success: boolean; updates?: any };
      if (response.success) {
        toast({ title: "Success", description: "Property settings have been updated." });
        await refreshUserProfile();
      } else {
        throw new Error("Update failed");
      }
    } catch (error) {
      console.error("Error saving property settings:", error);
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
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

  const defaultTierNames = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const defaultTierPoints = [0, 5, 15, 30, 60];

  return (
    <form onSubmit={handleSaveChanges} className="space-y-8">
      <Card>
        <CardHeader><CardTitle>{t('general_info.title')}</CardTitle><CardDescription>{t('general_info.description')}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label htmlFor="name">{t('general_info.name_label')}</Label><Input id="name" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="address">{t('general_info.address_label')}</Label><Input id="address" value={formData.address || ''} onChange={e => handleFormChange('address', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label htmlFor="phone">{t('general_info.phone_label')}</Label><Input id="phone" type="tel" value={formData.phone || ''} onChange={e => handleFormChange('phone', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="email">{t('general_info.email_label')}</Label><Input id="email" type="email" value={formData.email || ''} onChange={e => handleFormChange('email', e.target.value)} /></div>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label htmlFor="website">{t('general_info.website_label')}</Label><Input id="website" type="text" value={formData.website || ''} onChange={e => handleFormChange('website', e.target.value)} placeholder="www.example.com" /></div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>{t('policies.title')}</CardTitle><CardDescription>{t('policies.description')}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label htmlFor="defaultCheckInTime">{t('policies.checkin_label')}</Label><Input id="defaultCheckInTime" type="time" value={formData.defaultCheckInTime || ''} onChange={e => handleFormChange('defaultCheckInTime', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="defaultCheckOutTime">{t('policies.checkout_label')}</Label><Input id="defaultCheckOutTime" type="time" value={formData.defaultCheckOutTime || ''} onChange={e => handleFormChange('defaultCheckOutTime', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1"><Label htmlFor="timeZone">{t('policies.timezone_label')}</Label><Select value={formData.timeZone || ''} onValueChange={(v) => handleFormChange('timeZone', v)}><SelectTrigger id="timeZone"><SelectValue /></SelectTrigger><SelectContent>{timeZoneOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="currency">{t('policies.currency_label')}</Label><Select value={formData.currency || ''} onValueChange={(v) => handleFormChange('currency', v)}><SelectTrigger id="currency"><SelectValue /></SelectTrigger><SelectContent>{currencyOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center space-x-2">
              <Switch id="allowSameDayBookings" checked={bookingPageSettings?.allowSameDayBookings || false} onCheckedChange={(c) => handleBookingSettingsChange('allowSameDayBookings', c)} />
              <Label htmlFor="allowSameDayBookings">{t('policies.same_day_booking_label')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="allowSameDayTurnover" checked={bookingPageSettings?.allowSameDayTurnover || false} onCheckedChange={(c) => handleBookingSettingsChange('allowSameDayTurnover', c)} />
              <Label htmlFor="allowSameDayTurnover">{t('policies.same_day_turnover_label')}</Label>
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor="cancellationPolicy">{t('policies.cancellation_policy_label')}</Label><Textarea id="cancellationPolicy" value={formData.cancellationPolicy || ''} onChange={e => handleFormChange('cancellationPolicy', e.target.value)} placeholder={t('policies.cancellation_policy_placeholder')} /></div>
          <div className="space-y-1"><Label htmlFor="aboutUs">{t('policies.about_us_label')}</Label><Textarea id="aboutUs" value={formData.aboutUs || ''} onChange={e => handleFormChange('aboutUs', e.target.value)} placeholder={t('policies.about_us_placeholder')} /></div>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader><CardTitle>{t('legal_info.title')}</CardTitle><CardDescription>{t('legal_info.description')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label htmlFor="companyName">{t('legal_info.company_name_label')}</Label><Input id="companyName" value={legalInformation.companyName || ''} onChange={e => handleLegalInfoChange('companyName', e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="legalForm">{t('legal_info.legal_form_label')}</Label><Input id="legalForm" value={legalInformation.legalForm || ''} onChange={e => handleLegalInfoChange('legalForm', e.target.value)} /></div>
              </div>
               <div className="space-y-1"><Label htmlFor="capitalAmount">{t('legal_info.capital_amount_label')}</Label><Input id="capitalAmount" value={legalInformation.capitalAmount || ''} onChange={e => handleLegalInfoChange('capitalAmount', e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="businessAddress">{t('legal_info.business_address_label')}</Label><Input id="businessAddress" value={legalInformation.businessAddress || ''} onChange={e => handleLegalInfoChange('businessAddress', e.target.value)} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1"><Label htmlFor="rcNumber">{t('legal_info.rc_number_label')}</Label><Input id="rcNumber" value={legalInformation.rcNumber || ''} onChange={e => handleLegalInfoChange('rcNumber', e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="ifNumber">{t('legal_info.if_number_label')}</Label><Input id="ifNumber" value={legalInformation.ifNumber || ''} onChange={e => handleLegalInfoChange('ifNumber', e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="patenteNumber">{t('legal_info.patente_label')}</Label><Input id="patenteNumber" value={legalInformation.patenteNumber || ''} onChange={e => handleLegalInfoChange('patenteNumber', e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="iceNumber">{t('legal_info.ice_number_label')}</Label><Input id="iceNumber" value={legalInformation.iceNumber || ''} onChange={e => handleLegalInfoChange('iceNumber', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="bankAccountNumber">{t('legal_info.bank_account_label')}</Label>
                    <Input id="bankAccountNumber" value={legalInformation.bankAccountNumber || ''} onChange={e => handleLegalInfoChange('bankAccountNumber', e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="iban">{t('legal_info.iban_label')}</Label>
                    <Input id="iban" value={legalInformation.iban || ''} onChange={e => handleLegalInfoChange('iban', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label htmlFor="legalPhone">{t('legal_info.phone_label')}</Label><Input id="legalPhone" type="tel" value={legalInformation.phone || ''} onChange={e => handleLegalInfoChange('phone', e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="legalEmail">{t('legal_info.email_label')}</Label><Input id="legalEmail" type="email" value={legalInformation.email || ''} onChange={e => handleLegalInfoChange('email', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label htmlFor="legalWebsite">{t('legal_info.website_label')}</Label><Input id="legalWebsite" type="text" value={legalInformation.website || ''} onChange={e => handleLegalInfoChange('website', e.target.value)} placeholder="www.example.com" /></div>
                  <div className="space-y-1"><Label htmlFor="tvaInfo">{t('legal_info.tva_label')}</Label><Input id="tvaInfo" value={legalInformation.tvaInfo || ''} onChange={e => handleLegalInfoChange('tvaInfo', e.target.value)} placeholder={t('legal_info.tva_placeholder')} /></div>
              </div>
          </CardContent>
      </Card>

       <Card>
        <CardHeader><CardTitle>{t('finance.title')}</CardTitle><CardDescription>{t('finance.description')}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4 p-4 border rounded-md">
                <div className="flex items-center justify-between"><Label htmlFor="taxEnabled" className="font-medium">{t('finance.tax_settings_title')}</Label><Switch id="taxEnabled" checked={taxSettings.enabled} onCheckedChange={(c) => handleTaxChange('enabled', c)} /></div>
                 {taxSettings.enabled && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1"><Label htmlFor="taxName">{t('finance.tax_name_label')}</Label><Input id="taxName" value={taxSettings.name || ''} onChange={e => handleTaxChange('name', e.target.value)} placeholder={t('finance.tax_name_placeholder')} /></div>
                    <div className="space-y-1"><Label htmlFor="taxRate">{t('finance.tax_rate_label')}</Label><Input id="taxRate" type="number" value={taxSettings.rate || 0} onChange={e => handleTaxChange('rate', Number(e.target.value))} placeholder="10" min="0" max="100"/></div>
                 </div>)}
            </div>
             <div className="space-y-4 p-4 border rounded-md">
                <div className="flex items-center justify-between"><Label htmlFor="loyaltyEnabled" className="font-medium">{t('finance.loyalty_program_title')}</Label><Switch id="loyaltyEnabled" checked={loyaltySettings.enabled} onCheckedChange={(c) => handleLoyaltyChange('enabled', c)} /></div>
                 {loyaltySettings.enabled && (
                    <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                            <Label htmlFor="earningRate">{t('finance.earning_rate_label', { currency: currencySymbol })}</Label>
                            <Input id="earningRate" type="number" value={loyaltySettings.earningRate || 1} onChange={e => handleLoyaltyChange('earningRate', Number(e.target.value))} min="1" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="redemptionRate">{t('finance.points_value_label', { currency: currencySymbol })}</Label>
                                <Input id="redemptionRate" type="number" value={loyaltySettings.redemptionRate || 0.01} onChange={e => handleLoyaltyChange('redemptionRate', Number(e.target.value))} min="0.01" step="0.01"/>
                                <p className="text-xs text-muted-foreground">{t('finance.points_value_description')}</p>
                            </div>
                        </div>
                        <div>
                          <Label className="font-medium">{t('finance.loyalty_tiers_title')}</Label>
                          <p className="text-xs text-muted-foreground">{t('finance.loyalty_tiers_description')}</p>
                          <div className="space-y-2 mt-2">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="grid grid-cols-2 gap-4 items-center">
                                    <Input
                                        value={loyaltySettings.tiers?.[index]?.name ?? defaultTierNames[index]}
                                        onChange={(e) => handleTierChange(index, 'name', e.target.value)}
                                        placeholder={defaultTierNames[index]}
                                    />
                                    <Input
                                        type="number"
                                        value={loyaltySettings.tiers?.[index]?.minPoints ?? defaultTierPoints[index]}
                                        onChange={(e) => handleTierChange(index, 'minPoints', e.target.value)}
                                        placeholder={t('finance.loyalty_tiers_points_placeholder')}
                                        min="0"
                                    />
                                </div>
                              ))}
                          </div>
                        </div>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-start">
        <Button type="submit" disabled={isLoading || isFetching}>
          {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t('buttons.save_settings')}
        </Button>
      </div>
    </form>
  );
}

    
