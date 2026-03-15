
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { countries } from '@/lib/countries';
import { useTranslation } from 'react-i18next';
import { Combobox } from '../ui/combobox';
import { PhoneInput } from '../ui/phone-input';

const createGuestDetailsSchema = (requirePhone: boolean, t: (key: string) => string) => z.object({
    fullName: z.string().min(3, { message: t('guest_details_form.validation.full_name') }),
    email: z.string().email({ message: t('guest_details_form.validation.email') }),
    phone: requirePhone
        ? z.string().min(10, { message: t('guest_details_form.validation.phone') })
        : z.string().optional(),
    country: z.string().min(2, { message: t('guest_details_form.validation.country') }),
    notes: z.string().optional(),
});


interface GuestDetailsFormProps {
    onSubmit: (data: any) => void;
    isConfirming: boolean;
    requirePhone?: boolean;
}

export default function GuestDetailsForm({ onSubmit, isConfirming, requirePhone = false }: GuestDetailsFormProps) {
    const { t } = useTranslation(['booking_confirmation', 'country']);
    
    const guestDetailsSchema = createGuestDetailsSchema(requirePhone, (key: string) => t(key));
    type GuestDetailsFormValues = z.infer<typeof guestDetailsSchema>;

    const form = useForm<GuestDetailsFormValues>({
        resolver: zodResolver(guestDetailsSchema),
        defaultValues: {
            fullName: "",
            email: "",
            phone: "",
            country: "Morocco",
            notes: "",
        },
    });
    
    const countryOptions = countries.map(c => ({
        value: c.name,
        label: t(`country:countries.${c.code}`),
    }));

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>{t('guest_details_form.title')}</CardTitle>
                <CardDescription>{t('guest_details_form.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('guest_details_form.full_name_label')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('guest_details_form.full_name_placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('guest_details_form.email_label')}</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder={t('guest_details_form.email_placeholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('guest_details_form.phone_label')}{requirePhone && <span className="text-destructive">*</span>}</FormLabel>
                                        <FormControl>
                                            <PhoneInput {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                         <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('country:country_label')}</FormLabel>
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
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('guest_details_form.notes_label')}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder={t('guest_details_form.notes_placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" size="lg" className="w-full h-12 text-lg bg-[var(--booking-primary)] hover:bg-[var(--booking-primary-hover)]" disabled={isConfirming}>
                            {isConfirming ? (
                                <>
                                    <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
                                    {t('guest_details_form.confirm_button_loading')}
                                </>
                            ) : (
                                t('guest_details_form.confirm_button_default')
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
