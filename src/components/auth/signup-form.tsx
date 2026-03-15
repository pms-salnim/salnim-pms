
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { Loader2, Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { PropertyType } from "@/types/firestoreUser";
import { FirebaseError } from "firebase/app";
import { useTranslation } from "react-i18next";
import { Combobox } from "../ui/combobox";
import { countries } from "@/lib/countries";
import { useRouter } from "next/navigation";

const propertyTypes: PropertyType[] = ["Hotel", "Resort", "Apartment", "Villa"];

const signupFormSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
  country: z.string().min(2, { message: "Country is required." }),
  city: z.string().min(2, { message: "City is required." }),
  address: z.string().min(5, { message: "Your address is required." }),
  propertyName: z.string().min(2, { message: "Property name is required." }),
  propertyAddress: z.string().min(5, { message: "Property address is required." }),
  propertyType: z.enum(propertyTypes, {
    required_error: "You need to select a property type.",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['signup', 'country']);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      country: "",
      city: "",
      address: "",
      propertyName: "",
      propertyAddress: "",
    },
  });

  async function onSubmit(values: SignupFormValues) {
    setIsLoading(true);
    setError(null);
    try {
      const { password, ...data } = values;
      await signup(password, data);
      router.push('/dashboard');
    } catch (err: any) {
      if (err instanceof FirebaseError || err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
          case 'functions/already-exists':
          case 'already-exists':
            setError(t('toasts.error_email_in_use'));
            form.setError("email", { type: "manual", message: t('toasts.error_email_in_use') });
            break;
          case 'auth/weak-password':
            setError(t('toasts.error_weak_password'));
            form.setError("password", { type: "manual", message: t('toasts.error_weak_password')});
            break;
          default:
            setError(err.message || t('toasts.error_generic_signup'));
        }
      } else {
        setError(err.message || t('toasts.error_unknown'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  const countryOptions = countries.map(c => ({
    value: c.name,
    label: t(`country:countries.${c.code}`),
  }));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && !form.formState.errors.email && !form.formState.errors.password && ( 
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Signup Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.full_name_label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.full_name_placeholder')} {...field} autoComplete="name"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.email_label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.email_placeholder')} {...field} type="email" autoComplete="email"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.password_label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.password_placeholder')} {...field} type="password" autoComplete="new-password"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.confirm_password_label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.password_placeholder')} {...field} type="password" autoComplete="new-password"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.country_label')}</FormLabel>
                <Combobox
                    options={countryOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('country:country_placeholder')}
                    searchPlaceholder={t('country:search_placeholder')}
                    emptyText={t('country:no_country_found')}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.city_label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.city_placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.address_label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('form.address_placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <h3 className="text-lg font-medium pt-4 border-t mt-6">{t('form.property_details_heading')}</h3>
        <FormField
          control={form.control}
          name="propertyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.property_name_label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('form.property_name_placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="propertyAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.property_address_label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('form.property_address_placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="propertyType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.property_type_label')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.property_type_placeholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {propertyTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full mt-6" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('form.button_creating')}
            </>
          ) : (
            t('form.button_signup')
          )}
        </Button>
      </form>
    </Form>
  );
}
