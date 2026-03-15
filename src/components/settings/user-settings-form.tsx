
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "@/hooks/use-toast";
import { db, auth as firebaseAuth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { FirestoreUser } from '@/types/firestoreUser';
import { Icons } from '../icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTranslation } from 'react-i18next';

export default function UserSettingsForm() {
  const { user, refreshUserProfile, preferredLanguage, setPreferredLanguage } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { t } = useTranslation('pages/settings/user/content');

  // Form state
  const [fullName, setFullName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [country, setCountry] = useState(user?.country || "");
  const [city, setCity] = useState(user?.city || "");
  const [address, setAddress] = useState(user?.address || "");
  const [language, setLanguage] = useState(preferredLanguage || 'en');


  useEffect(() => {
    if (user?.id) {
      setIsFetching(true);
      const userDocRef = doc(db, "staff", user.id);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data() as FirestoreUser;
          setFullName(data.fullName || "");
          setPhone(data.phone || "");
          setCountry(data.country || "");
          setCity(data.city || "");
          setAddress(data.address || "");
          setLanguage(data.preferredLanguage || 'en');
        }
        setIsFetching(false);
      }).catch(error => {
        console.error("Error fetching user settings:", error);
        toast({ title: "Error", description: t('toasts.error_loading'), variant: "destructive" });
        setIsFetching(false);
      });
    } else {
      setIsFetching(false); // No user, no fetching
    }
  }, [user?.id, t]);
  
  useEffect(() => {
    setLanguage(preferredLanguage);
  }, [preferredLanguage]);

  const handleSaveChanges = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) {
      toast({ title: "Error", description: t('toasts.error_not_authenticated'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const userDocRef = doc(db, "staff", user.id);
    try {
      await updateDoc(userDocRef, {
        fullName,
        phone,
        country,
        city,
        address,
        preferredLanguage: language,
        updatedAt: serverTimestamp(),
      });
      toast({
          title: "Settings Saved",
          description: t('toasts.success_save'),
      });
      setPreferredLanguage(language); // Update context immediately
      await refreshUserProfile(); 
    } catch (error) {
      console.error("Error saving user settings:", error);
      toast({ title: "Error", description: t('toasts.error_save'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (user?.email) {
      try {
        await sendPasswordResetEmail(firebaseAuth, user.email);
        toast({
            title: "Password Reset Email Sent",
            description: t('toasts.success_password_reset'),
        });
      } catch (error: any) {
        console.error("Error sending password reset email:", error);
        toast({ title: "Error", description: error.message || t('toasts.error_password_reset'), variant: "destructive" });
      }
    } else {
      toast({ title: "Error", description: t('toasts.error_email_not_found'), variant: "destructive" });
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
    <form onSubmit={handleSaveChanges} className="space-y-6">
      <Card className="shadow-sm">
          <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="fullName">{t('form.full_name_label')}</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('form.full_name_placeholder')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label htmlFor="email">{t('form.email_label')}</Label>
                      <Input id="email" type="email" value={user?.email || ""} placeholder={t('form.email_placeholder')} readOnly disabled className="bg-muted/50" />
                  </div>
                   <div className="space-y-1">
                      <Label htmlFor="role">{t('form.role_label')}</Label>
                      <Input id="role" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : t('form.role_not_available')} readOnly disabled className="bg-muted/50 capitalize" />
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label htmlFor="phone">{t('form.phone_label')}</Label>
                      <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('form.phone_placeholder')} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="language">{t('form.language_label')}</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="language">
                          <SelectValue placeholder={t('form.language_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="en">{t('languages.en')}</SelectItem>
                          <SelectItem value="fr">{t('languages.fr')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label htmlFor="country">{t('form.country_label')}</Label>
                      <Input id="country" value={country} onChange={e => setCountry(e.target.value)} placeholder={t('form.country_placeholder')} />
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="city">{t('form.city_label')}</Label>
                      <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder={t('form.city_placeholder')} />
                  </div>
              </div>
              <div className="space-y-1">
                  <Label htmlFor="address">{t('form.address_label')}</Label>
                  <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder={t('form.address_placeholder')} />
              </div>
                <div>
                  <Button type="button" variant="outline" onClick={handleChangePassword}>
                      {t('form.change_password_button')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">{t('form.change_password_description')}</p>
              </div>
          </CardContent>
      </Card>
      
      <div className="flex justify-start">
          <Button type="submit" disabled={isLoading || isFetching}>
              {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
              {t('form.save_button')}
          </Button>
      </div>
    </form>
  );
}
