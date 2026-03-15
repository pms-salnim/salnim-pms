
"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from "@/components/icons";

const NotificationRulesForm = dynamic(() => import("@/components/guests/notification-rules-form"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
});


export default function NotificationSettingsPage() {

  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
      <NotificationRulesForm />
    </Suspense>
  );
}
