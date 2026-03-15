
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[A-Z]/, { message: "Must contain at least one uppercase letter." })
    .regex(/[a-z]/, { message: "Must contain at least one lowercase letter." })
    .regex(/[0-9]/, { message: "Must contain at least one number." })
    .regex(/[^A-Za-z0-9]/, { message: "Must contain at least one special character." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

type PageStatus = "verifying" | "invalid" | "valid" | "success";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [status, setStatus] = useState<PageStatus>("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  
  useEffect(() => {
    if (!oobCode) {
      setStatus("invalid");
      setErrorMessage("No reset code provided. Please request a new password reset link.");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setUserEmail(email);
        setStatus("valid");
      })
      .catch((error) => {
        setStatus("invalid");
        switch (error.code) {
          case 'auth/expired-action-code':
            setErrorMessage("This password reset link has expired. Please request a new one.");
            break;
          case 'auth/invalid-action-code':
            setErrorMessage("This password reset link is invalid. It may have already been used.");
            break;
          default:
            setErrorMessage("An error occurred while verifying the reset link. Please try again.");
            break;
        }
      });
  }, [oobCode]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (status !== 'valid' || !oobCode) return;
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      await confirmPasswordReset(auth, oobCode, values.password);
      setStatus("success");
      toast({ title: "Success!", description: "Your password has been reset. You can now log in with your new password." });
    } catch (error: any) {
      if (error instanceof FirebaseError && error.code === 'auth/weak-password') {
        form.setError('password', { type: 'manual', message: error.message });
      } else {
        setErrorMessage("Failed to reset password. The link may have expired. Please try again.");
        toast({ title: "Error", description: "Failed to reset password. Please request a new link.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="flex flex-col items-center justify-center space-y-2">
            <Icons.Spinner className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Verifying link...</p>
          </div>
        );
      case 'invalid':
        return (
          <Alert variant="destructive">
            <Icons.AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid Link</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        );
      case 'success':
        return (
          <Alert variant="default" className="border-green-300 bg-green-50 text-green-800">
            <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Password Reset Successfully!</AlertTitle>
            <AlertDescription>
              You can now log in with your new credentials.
            </AlertDescription>
          </Alert>
        );
      case 'valid':
        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {errorMessage && (
                  <Alert variant="destructive"><Icons.AlertCircle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></Alert>
              )}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl><Input placeholder="••••••••" {...field} type="password" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl><Input placeholder="••••••••" {...field} type="password" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </Form>
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" aria-label="Homepage">
            <Image src="/logo.webp" alt="Salnim Pms Logo" width={225} height={56} className="mx-auto" style={{ height: 'auto' }} priority />
          </Link>
        </div>
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset Your Password</CardTitle>
            <CardDescription>
                {status === 'valid' && `Enter a new password for ${userEmail}.`}
                {status === 'verifying' && 'Please wait while we verify your request.'}
                {status === 'invalid' && 'This link is no longer valid.'}
                {status === 'success' && 'Your password has been changed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            {renderContent()}
          </CardContent>
        </Card>
        <div className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordActionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
