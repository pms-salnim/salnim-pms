
"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from '@/components/icons';

const SignupPageClient = dynamic(() => import('@/components/auth/signup-page-client'), {
  loading: () => <div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
  ssr: false,
});

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
      <SignupPageClient />
    </Suspense>
  );
}
