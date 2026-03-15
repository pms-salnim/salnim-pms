
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';


const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation('forgot-password');

  // State to manage client-side rendering and avoid hydration mismatch
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    try {
      // Correct the actionCodeSettings URL to point to the new reset page.
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/reset_pass/action`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, values.email, actionCodeSettings);
      setIsSuccess(true);
      toast({
        title: t('success_title'),
        description: t('success_description'),
      });
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(t('error_description'));
    } finally {
      setIsLoading(false);
    }
  };

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
        </div>
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{isClient ? t('title') : 'Reset Your Password'}</CardTitle>
            <CardDescription>
              {isClient ? t('description') : 'Enter your email to receive a password reset link.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 sm:px-8">
            {isSuccess ? (
              <div className="space-y-4 text-center">
                <Alert variant="default" className="border-green-300 bg-green-50 text-green-800">
                  <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>{isClient ? t('success_title') : 'Email Sent!'}</AlertTitle>
                  <AlertDescription>
                    {isClient ? t('success_description') : 'If an account exists, a reset link has been sent.'}
                  </AlertDescription>
                </Alert>
                <Button asChild variant="link">
                  <Link href="/login">{isClient ? t('back_to_login') : 'Back to Login'}</Link>
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                   {error && (
                    <Alert variant="destructive">
                      <Icons.AlertCircle className="h-4 w-4" />
                      <AlertTitle>{isClient ? t('error_title') : 'Error'}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isClient ? t('email_label') : 'Email Address'}</FormLabel>
                        <FormControl>
                          <Input placeholder={isClient ? t('email_placeholder') : 'name@example.com'} {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
                        {isClient ? t('sending_button') : 'Sending...'}
                      </>
                    ) : (
                      isClient ? t('send_button') : 'Send Reset Link'
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
        {!isSuccess && (
          <div className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-primary hover:underline">
              {isClient ? t('back_to_login') : 'Back to Login'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Dynamically import the form with SSR turned off
const DynamicForgotPasswordForm = dynamic(() => Promise.resolve(ForgotPasswordForm), {
    ssr: false,
    loading: () => <div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>
});

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
      <DynamicForgotPasswordForm />
    </Suspense>
  );
}
