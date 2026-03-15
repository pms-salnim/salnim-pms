
"use client";

import React, { useState, useEffect } from 'react';
import RoomsList from "@/components/rooms/rooms-list";
import { useAuth } from '@/contexts/auth-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FirestoreUser } from '@/types/firestoreUser';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

export default function RoomsListPage() {
  const { user, isLoadingAuth } = useAuth();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [isLoadingPropertyId, setIsLoadingPropertyId] = useState(true);
  const { t } = useTranslation('pages/rooms/list/content');

  useEffect(() => {
    if (user?.id) {
      setIsLoadingPropertyId(true);
      const staffDocRef = doc(db, "staff", user.id);
      const unsubscribe = onSnapshot(staffDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const staffData = docSnap.data() as FirestoreUser;
          setPropertyId(staffData.propertyId);
        } else {
          console.error("Staff document not found for user:", user.id);
          setPropertyId(null);
        }
        setIsLoadingPropertyId(false);
      });
      return () => unsubscribe();
    } else {
      setIsLoadingPropertyId(false);
    }
  }, [user?.id]);

  if (isLoadingAuth || isLoadingPropertyId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">{t('loading_property')}</p>
      </div>
    );
  }

  if (!user?.permissions?.rooms) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!propertyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">
          {t('no_property_loaded')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
        {t('title')}
      </h1>
      <p className="text-muted-foreground">
        {t('description')}
      </p>
      <RoomsList propertyId={propertyId} />
    </div>
  );
}
