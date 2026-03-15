
"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from '@/components/icons';

const BookingSuccessClient = dynamic(
  () => import('@/components/booking/booking-success-client'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
      </div>
    ),
  }
);

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
      <BookingSuccessClient />
    </Suspense>
  );
}
