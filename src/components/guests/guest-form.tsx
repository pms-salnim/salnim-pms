
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Guest } from '@/types/guest';
import { Switch } from '../ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, MapPin, Flag, FileText, Gift, Check } from 'lucide-react';
import { countries } from '@/lib/countries';

interface GuestFormProps {
  onClose: () => void;
  initialData: Guest | null;
  onSave: (data: Omit<Guest, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'tags' | 'totalReservations' | 'lastStayDate' | 'loyaltyPoints' | 'totalPointsEarned' | 'totalPointsRedeemed'> & Partial<Pick<Guest, 'tags' | 'loyaltyStatus'>>) => void;
}

const genders = ["Male", "Female"];
export default function GuestForm({ onClose, initialData, onSave }: GuestFormProps) {
  const { property } = useAuth();
  const { t } = useTranslation('pages/guests/all/content');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [nationality, setNationality] = useState('');
  const [phoneCode, setPhoneCode] = useState(() => {
    if (!nationality) return '';
    const countryData = countries.find(c => c.name === nationality);
    return countryData?.phone || '';
  });
  const [address, setAddress] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);

  const isLoyaltyEnabled = property?.loyaltyProgramSettings?.enabled || false;

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName || '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setGender(initialData.gender || '');
      setBirthdate(initialData.birthdate ? (typeof initialData.birthdate === 'string' ? parseISO(initialData.birthdate) : initialData.birthdate) : undefined);
      setNationality(initialData.nationality || '');
      // Update phoneCode when nationality changes
      if (initialData.nationality) {
        const countryData = countries.find(c => c.name === initialData.nationality);
        setPhoneCode(countryData?.phone || '');
      }
      setAddress(initialData.address || '');
      setInternalNotes(initialData.internalNotes || '');
      setIsEnrolled(initialData.loyaltyStatus === 'enrolled' || false);
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setPhoneCode('');
      setGender('');
      setBirthdate(undefined);
      setNationality('');
      setAddress('');
      setInternalNotes('');
      setIsEnrolled(false);
    }
  }, [initialData]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName || !email) {
        alert("Full name and email are required.");
        return;
    }
    onSave({
      fullName,
      email,
      phone,
      gender,
      birthdate: birthdate ? format(birthdate, "yyyy-MM-dd") : undefined,
      nationality,
      address,
      internalNotes,
      loyaltyStatus: isLoyaltyEnabled ? (isEnrolled ? 'enrolled' : 'not-enrolled') : 'not-enrolled',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-4 max-h-[72vh] overflow-y-auto pr-4">
      {/* Personal Information Card */}
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900">{t('form.sections.personal_details')}</CardTitle>
              <CardDescription>Basic guest information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-slate-500" />
                {t('form.full_name_label')} <span className="text-red-500">*</span>
              </div>
            </Label>
            <Input 
              id="fullName" 
              placeholder="John Doe" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required
              className="h-9 border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Gender & Birthdate Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-sm font-medium text-slate-700">
                {t('form.gender_label')}
              </Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender" className="h-9 border-slate-300 bg-white">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthdate" className="text-sm font-medium text-slate-700">
                {t('form.birthdate_label')}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {/* Month */}
                <Select 
                  value={birthdate ? format(birthdate, 'MM') : ''} 
                  onValueChange={(month) => {
                    if (birthdate) {
                      const newDate = new Date(birthdate);
                      newDate.setMonth(parseInt(month) - 1);
                      setBirthdate(newDate);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 border-slate-300 bg-white">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date(2000, i, 1);
                      return (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {format(date, 'MMM')}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Day */}
                <Select 
                  value={birthdate ? format(birthdate, 'dd') : ''} 
                  onValueChange={(day) => {
                    if (birthdate) {
                      const newDate = new Date(birthdate);
                      newDate.setDate(parseInt(day));
                      setBirthdate(newDate);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 border-slate-300 bg-white">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Year */}
                <Select 
                  value={birthdate ? format(birthdate, 'yyyy') : ''} 
                  onValueChange={(year) => {
                    if (birthdate) {
                      const newDate = new Date(birthdate);
                      newDate.setFullYear(parseInt(year));
                      setBirthdate(newDate);
                    } else {
                      setBirthdate(new Date(parseInt(year), 0, 1));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 border-slate-300 bg-white">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 124 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {birthdate && (
                <p className="text-xs text-slate-500 mt-1">
                  {format(birthdate, 'MMMM dd, yyyy')}
                </p>
              )}
            </div>
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <Label htmlFor="nationality" className="text-sm font-medium text-slate-700">
              <div className="flex items-center gap-1">
                <Flag className="h-4 w-4 text-slate-500" />
                {t('form.nationality_label')}
              </div>
            </Label>
            <Select value={nationality} onValueChange={(value) => {
              setNationality(value);
              const countryData = countries.find(c => c.name === value);
              const newPhoneCode = countryData?.phone || '';
              setPhoneCode(newPhoneCode);
              // Auto-prepend country code to phone field
              setPhone(`+${newPhoneCode} `);
            }}>
              <SelectTrigger id="nationality" className="h-9 border-slate-300 bg-white">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {countries.map(country => <SelectItem key={country.name} value={country.name}>{country.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Card */}
      <Card className="border-slate-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Phone className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900">{t('form.sections.contact_details')}</CardTitle>
              <CardDescription>Email and contact information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4 text-slate-500" />
                {t('form.email_label')} <span className="text-red-500">*</span>
              </div>
            </Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              className="h-9 border-slate-300 bg-white hover:border-slate-400 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4 text-slate-500" />
                {t('form.phone_label')}
              </div>
            </Label>
            <div className="flex gap-2 items-center">
              <Select value={nationality} onValueChange={(value) => {
                setNationality(value);
                const countryData = countries.find(c => c.name === value);
                const newPhoneCode = countryData?.phone || '';
                setPhoneCode(newPhoneCode);
                // Auto-prepend country code to phone field
                setPhone(`+${newPhoneCode} `);
              }}>
                <SelectTrigger className="w-24 flex-shrink-0 h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.name}>
                      {c.code} (+{c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                id="phone"
                value={phone}
                onChange={(e) => {
                  // If phone code exists, ensure the number starts with +code
                  const value = e.target.value;
                  if (phoneCode && !value.startsWith(`+${phoneCode}`)) {
                    // If user clears it or types something else, reset with code prefix
                    if (value.trim() === '' || !value.startsWith('+')) {
                      setPhone(`+${phoneCode} `);
                    } else {
                      setPhone(value);
                    }
                  } else {
                    setPhone(value);
                  }
                }}
                placeholder="+X XXX XXXX XXXX"
                className="flex-1 h-9 border-slate-300 bg-white hover:border-slate-400 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium text-slate-700">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-500" />
                {t('form.address_label')}
              </div>
            </Label>
            <Textarea 
              id="address" 
              placeholder="123 Main St, City, State 12345" 
              value={address} 
              onChange={(e) => setAddress(e.target.value)}
              className="border-slate-300 bg-white hover:border-slate-400 focus:border-emerald-500 focus:ring-emerald-500 min-h-20 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes Card */}
      <Card className="border-slate-200 bg-gradient-to-br from-amber-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900">{t('form.sections.internal_notes')}</CardTitle>
              <CardDescription>Private notes for your team</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="internalNotes" className="text-sm font-medium text-slate-700">
            {t('form.notes_label')}
          </Label>
          <Textarea 
            id="internalNotes" 
            placeholder="Add any internal notes about this guest..." 
            value={internalNotes} 
            onChange={(e) => setInternalNotes(e.target.value)}
            className="border-slate-300 bg-white hover:border-slate-400 focus:border-amber-500 focus:ring-amber-500 min-h-20 resize-none"
          />
        </CardContent>
      </Card>

      {/* Loyalty Program Card */}
      {isLoyaltyEnabled && (
        <Card className="border-slate-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base text-slate-900">{t('form.sections.loyalty_program')}</CardTitle>
                <CardDescription>Loyalty program enrollment</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-purple-200 hover:border-purple-300 transition-colors">
              <div>
                <p className="font-medium text-slate-900 text-sm">{t('form.enroll_loyalty_label')}</p>
                <p className="text-xs text-slate-500 mt-0.5">Guest can earn points and reach tier status</p>
              </div>
              <Switch 
                id="loyalty-enroll" 
                checked={isEnrolled} 
                onCheckedChange={setIsEnrolled}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <DialogFooter className="pt-4 border-t border-slate-200 sticky bottom-0 bg-white gap-2">
        <DialogClose asChild>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {t('form.buttons.cancel')}
          </Button>
        </DialogClose>
        <Button 
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Check className="mr-2 h-4 w-4" />
          {t('form.buttons.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

