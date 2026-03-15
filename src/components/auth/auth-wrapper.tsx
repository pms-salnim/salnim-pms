"use client";

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import React, { useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthWrapperProps {
  children: ReactNode;
}

// A simple loader component for AuthWrapper's internal use
function AuthLoader({ message }: { message?: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message && <p className="ml-2 text-foreground">{message}</p>}
    </div>
  );
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If auth state is determined and the user is not authenticated,
    // redirect them from this protected layout to the login page.
    if (!isLoadingAuth && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  // While loading authentication state, show a loader.
  if (isLoadingAuth) {
    return <AuthLoader message="Verifying authentication..." />;
  }
  
  // If not authenticated (and useEffect is about to redirect), show a loader.
  if (!isAuthenticated) {
    return <AuthLoader message="Redirecting to login..." />;
  }
  
  // If authenticated, render the protected page content.
  return <>{children}</>;
}
