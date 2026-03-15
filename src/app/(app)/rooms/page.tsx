
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

export default function RoomsRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/rooms/overview');
  }, [router]);

  return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" /> 
        <p className="ml-2">Loading Rooms...</p>
      </div>
  );
}
