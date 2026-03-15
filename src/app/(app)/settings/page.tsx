
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page will redirect to the default settings tab (e.g., user settings)
export default function SettingsRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/user');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Loading settings...</p>
    </div>
  );
}
