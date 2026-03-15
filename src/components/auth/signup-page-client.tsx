
"use client";

import { useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from 'next/image';
import { useTranslation } from 'react-i18next';

const SignupForm = dynamic(() => import('@/components/auth/signup-form').then(mod => mod.SignupForm), {
    loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
    ssr: false
});

export default function SignupPageClient() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('signup');

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  if (isLoadingAuth || isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Icons.Spinner className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <Link href="/" aria-label="Homepage">
            <Image
              src="/logo.webp"
              alt="Salnim Pms Logo"
              width={225}
              height={56}
              className="mx-auto"
              style={{ height: 'auto' }}
              priority
            />
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">{t('card_title')}</CardTitle>
            <CardDescription>{t('card_description')}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
                <SignupForm />
            </Suspense>
          </CardContent>
        </Card>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Salnim Pms
        </p>
      </div>
    </div>
  );
}
