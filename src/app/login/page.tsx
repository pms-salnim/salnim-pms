
"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from '@/components/icons';

const LoginComponent = dynamic(() => import('@/components/auth/login-component'), {
  loading: () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Icons.Spinner className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading...</p>
    </div>
  ),
  ssr: false,
});

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
      <LoginComponent />
    </Suspense>
  );
}
