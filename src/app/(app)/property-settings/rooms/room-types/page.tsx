'use client';

import React, { useState } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import RoomTypesComponent from '@/components/rooms/room-types';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const roomsSubtabs = [
  { id: 'room-types', label: 'Room Types', href: '/property-settings/rooms/room-types' },
  { id: 'rooms', label: 'Rooms', href: '/property-settings/rooms/rooms' },
];

export default function RoomTypesPage() {
  const { property, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading property...</p>
      </div>
    );
  }

  if (!property?.id) {
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
      <RoomTypesComponent propertyId={property.id} />
    </div>
  );
}
