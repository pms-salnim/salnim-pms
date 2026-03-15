
"use client";

import { useAuth } from '@/contexts/auth-context';
import React, { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from "lucide-react"; 
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { Icons } from '../icons';

const LoginForm = dynamic(() => import('@/components/auth/login-form').then(mod => mod.LoginForm), {
    ssr: false,
    loading: () => <div className="h-40 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>
});

function LoginComponentContent() {
  const { isAuthenticated, isLoadingAuth, preferredLanguage, setPreferredLanguage } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoadingAuth, router]);
  
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setPreferredLanguage(lang);
  };


  if (isLoadingAuth || isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{isClient ? t('loading') : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
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
          <p className="mt-4 text-sm text-muted-foreground">
            {t('login_page_title')}
          </p>
        </div>
        
        <Card className="shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <Suspense fallback={<div className="h-40 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
                <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        <div className="text-center text-sm space-y-2">
            <p>
                <Link href="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
                    {t('forgot_password_link')}
                </Link>
            </p>
            <div className="pt-2">
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                       <Icons.Globe className="mr-2 h-4 w-4" />
                       {t('language_switcher_label')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleLanguageChange('en')}>English</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLanguageChange('fr')}>Français</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Salnim Pms
        </p>
      </div>
    </div>
  );
}

export default function LoginComponent() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
            <LoginComponentContent />
        </Suspense>
    );
}
