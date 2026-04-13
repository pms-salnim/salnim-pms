'use client';

import React from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import RoomsListComponent from '@/components/rooms/rooms-list';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';

const roomsSubtabs = [
  { id: 'room-types', label: 'Room Types', href: '/property-settings/rooms/room-types' },
  { id: 'rooms', label: 'Rooms', href: '/property-settings/rooms/rooms' },
];

export default function RoomsPage() {
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
          Rooms
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
          Manage individual rooms and their configuration
        </p>
      </div>
      <RoomsListComponent propertyId={property.id} />
    </div>
  );
}
