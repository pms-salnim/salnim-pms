
"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from "@/components/icons";

const PropertySettingsForm = dynamic(() => import('@/components/settings/property-settings-form'), {
  loading: () => <div className="flex h-64 items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
  ssr: false,
});

export default function PropertySettingsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
        <PropertySettingsForm />
    </Suspense>
  );
}
