"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

export default function RatePlansRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/rate-plans/all');
  }, [router]);

  return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" /> 
        <p className="ml-2">Loading Rate Plans...</p>
      </div>
  );
}
