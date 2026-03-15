
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

export default function StaffRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/staff-users/users');
  }, [router]);

  return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" /> 
        <p className="ml-2">Loading Staff...</p>
      </div>
  );
}
