'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomsSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first tab (room-types) to avoid 404
    router.replace('/property-settings/rooms/room-types');
  }, [router]);

  return null;
}
