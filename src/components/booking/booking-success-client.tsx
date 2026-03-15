
"use client";

import React from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BookingSuccessClient() {
    const searchParams = useSearchParams();
    const params = useParams();
    const propertySlug = params.propertySlug as string;
    const guestName = searchParams.get('name') || 'Guest';
    const { t } = useTranslation('booking_confirmation');

    return (
        <div className="w-full max-w-[1500px] mx-auto p-4 flex items-center justify-center min-h-[calc(100vh-80px)]">
            <Card className="w-full max-w-2xl text-center shadow-xl">
                <CardHeader>
                    <div className="mx-auto bg-green-100 rounded-full h-16 w-16 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-3xl font-bold mt-4">{t('title')}</CardTitle>
                    <CardDescription className="text-lg text-[var(--booking-primary)] font-medium">
                        {t('thank_you', { name: guestName })}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-foreground">
                        {t('confirmation_message')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {t('follow_up_message')}
                    </p>
                    <div className="pt-4">
                        <Button asChild size="lg" className="bg-[var(--booking-primary)] hover:bg-[var(--booking-primary-hover)]">
                            <Link href={`/booking/${propertySlug}`}>{t('make_another_booking_button')}</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
