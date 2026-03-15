
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';

export default function HomePage() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoadingAuth) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  // Show a loading spinner while determining auth state and redirecting
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Icons.Spinner className="h-8 w-8 animate-spin" />
    </div>
  );
}
