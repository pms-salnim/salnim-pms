'use client';

import React, { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import RoomTypesComponent from '@/components/rooms/room-types';
import { useAuth } from '@/contexts/auth-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FirestoreUser } from '@/types/firestoreUser';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const roomsSubtabs = [
  { id: 'room-types', label: 'Room Types', href: '/property-settings/rooms/room-types' },
  { id: 'rooms', label: 'Rooms', href: '/property-settings/rooms/rooms' },
];

export default function RoomTypesPage() {
  const { user, isLoadingAuth } = useAuth();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [isLoadingPropertyId, setIsLoadingPropertyId] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setIsLoadingPropertyId(true);
      const staffDocRef = doc(db, 'staff', user.id);
      const unsubscribe = onSnapshot(staffDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const staffData = docSnap.data() as FirestoreUser;
          setPropertyId(staffData.propertyId);
        } else {
          console.error('Staff document not found for user:', user.id);
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
        <p className="ml-2 text-muted-foreground">Loading property...</p>
      </div>
    );
  }

  if (!user?.permissions?.rooms) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to access room settings.
        </AlertDescription>
      </Alert>
    );
  }

  if (!propertyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Room Types
        </h1>
        <p className="text-muted-foreground">
          No property loaded
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Rooms</h1>
        <PropertySettingsSubtabs subtabs={roomsSubtabs} />
      </div>
      <div>
        <p className="text-muted-foreground">
          Create and manage different room types for your property
        </p>
      </div>
      <RoomTypesComponent propertyId={propertyId} />
    </div>
  );
}
