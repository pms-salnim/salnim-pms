
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { FirebaseError } from "firebase/app"; 
import { useTranslation } from 'react-i18next';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();

  // ✅ Check if user was logged out due to account being disabled
  useEffect(() => {
    const wasDisabledWhileLoggedIn = localStorage.getItem('disabledAccountLogout');
    if (wasDisabledWhileLoggedIn) {
      console.log('Displaying disabled account logout message');
      setError('Your account has been disabled by an administrator. You have been logged out.');
      // Clean up the flag so it only shows once
      localStorage.removeItem('disabledAccountLogout');
    }
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    setError(null);
    console.log('Login attempt for:', values.email);
    
    try {
      await login(values.email, values.password);
      console.log('Login successful');
      // Successful login will trigger redirection via AuthContext's onAuthStateChanged.
    } catch (err: any) {
      console.error('Login error caught:', err);
      let errorMessage = t('login_error_generic');

      if (err instanceof FirebaseError) {
        console.log('FirebaseError:', err.code);
        switch (err.code) {
          case 'auth/invalid-credential':
            errorMessage = t('login_error_invalid_credentials');
            break;
          case 'auth/user-disabled':
            errorMessage = t('login_error_user_disabled');
            break;
          case 'auth/network-request-failed':
            errorMessage = t('login_error_network_failed');
            break;
          default:
            errorMessage = err.message || t('login_error_generic');
        }
      } else if (err.message?.includes('disabled')) {
        // Handle account disabled message from our custom auth
        console.log('Account disabled detected');
        errorMessage = 'Your account has been disabled. Please contact your administrator.';
      } else if (err.message?.includes('Invalid') || err.message?.includes('invalid')) {
        errorMessage = t('login_error_invalid_credentials');
      } else {
        errorMessage = err.message || t('login_error_generic');
      }

      console.log('Setting error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>{t('login_failed_title')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('login_form_email_label')}</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('login_form_password_label')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input placeholder="••••••••" {...field} type={showPassword ? "text" : "password"} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full px-3"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}...
            </>
          ) : (
            t('login_form_button')
          )}
        </Button>
      </form>
    </Form>
  );
}
