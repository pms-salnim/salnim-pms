
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Icons } from '@/components/icons';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import type { SelectedExtra } from '@/components/calendar/types';
import { useTranslation } from 'react-i18next';
import { Tag, Calendar as CalendarIcon, Users } from 'lucide-react';
import type { Property } from '@/types/property';
import type { Promotion } from '@/types/promotion';
import { collection, query, where, getDocs, limit } from 'firebase/firestore'; 
import { db, app } from '@/lib/firebase'; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import BookingSummary from '@/components/booking/booking-summary';

const GuestDetailsForm = dynamic(() => import('@/components/booking/guest-details-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


export default function BookingConfirmationPage() {
    const router = useRouter();
    const params = useParams();
    const propertySlug = params.propertySlug as string;
    const { t, i18n } = useTranslation('booking_confirmation');
    const locale = i18n.language === 'fr' ? fr : enUS;

    const [bookingState, setBookingState] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);
    const [property, setProperty] = useState<Property | null>(null);

    useEffect(() => {
        const fetchPropertyData = async () => {
            if (!propertySlug) return;
            try {
                const propQuery = query(collection(db, "properties"), where("slug", "==", propertySlug), limit(1));
                const propSnap = await getDocs(propQuery);
                if (propSnap.empty) throw new Error("Property not found");
                const propData = { id: propSnap.docs[0].id, ...propSnap.docs[0].data() } as Property;
                setProperty(propData);
            } catch (error) {
                console.error("Failed to fetch property settings:", error);
            }
        };

        fetchPropertyData();
    }, [propertySlug]);

    useEffect(() => {
        try {
            const storedState = localStorage.getItem('bookingState');
            if (storedState) {
                const parsedState = JSON.parse(storedState);
                if (!parsedState.selections || parsedState.selections.length === 0) {
                     toast({ title: t('toasts.empty_booking_title'), description: t('toasts.empty_booking_description'), variant: "destructive" });
                     router.replace(`/booking/${propertySlug}`);
                } else {
                    if (parsedState.dateRange?.from) {
                        parsedState.dateRange.from = parseISO(parsedState.dateRange.from);
                    }
                    if (parsedState.dateRange?.to) {
                        parsedState.dateRange.to = parseISO(parsedState.dateRange.to);
                    }
                    setBookingState(parsedState);
                }
            } else {
                toast({ title: t('toasts.session_not_found_title'), description: t('toasts.session_not_found_description'), variant: "destructive" });
                router.replace(`/booking/${propertySlug}`);
            }
        } catch (error) {
            console.error("Failed to parse booking state:", error);
            router.replace(`/booking/${propertySlug}`);
        } finally {
            setIsLoading(false);
        }
    }, [propertySlug, router, t]);
    
    
    const handleConfirmBooking = async (guestData: { fullName: string; email: string; phone: string; country: string; notes?: string }) => {
        if (!bookingState || isConfirming || !propertySlug) return;
        setIsConfirming(true);
        
        const payloadForFunction = {
            propertySlug,
            guestData,
            bookingState: {
                ...bookingState,
                dateRange: {
                    from: bookingState.dateRange.from.toISOString(),
                    to: bookingState.dateRange.to.toISOString(),
                },
            },
        };
        
        try {
            const functions = getFunctions(app, 'europe-west1');
            const createBookingFromPage = httpsCallable(functions, 'createBookingFromPage');
            
            const response = await createBookingFromPage(payloadForFunction);
            const data = response.data as any;

            if (data.success) {
                toast({ title: t('toasts.success_title'), description: t('toasts.success_description') });
                localStorage.removeItem('bookingState');
                router.push(`/booking/${propertySlug}/success?name=${encodeURIComponent(guestData.fullName)}`);
            } else {
                 throw new Error(data.error || "An unknown error occurred during booking.");
            }
        } catch (error) {
            console.error("Error confirming booking:", error);
            toast({ title: t('toasts.booking_failed_title'), description: error instanceof Error ? error.message : t('toasts.booking_failed_description'), variant: "destructive" });
        } finally {
            setIsConfirming(false);
        }
    };

    if (isLoading || !bookingState) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Icons.Spinner className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-[1500px] mx-auto p-8">
            <header className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight text-foreground font-headline">
                    {t('header.title')}
                </h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    {t('header.description')}
                </p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <main className="lg:col-span-2">
                   <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin"/></div>}>
                     <GuestDetailsForm 
                          onSubmit={handleConfirmBooking} 
                          isConfirming={isConfirming}
                          requirePhone={bookingState.requireGuestPhone}
                      />
                   </Suspense>
                </main>
                <aside className="lg:col-span-1 space-y-6 sticky top-6">
                    <BookingSummary
                      selections={bookingState.selections}
                      dateRange={bookingState.dateRange}
                      guests={bookingState.guests}
                      currency={bookingState.currency}
                      property={property}
                      onContinue={handleConfirmBooking}
                      priceDetails={bookingState} // Pass the entire state which contains price details
                      allPromotions={[]}
                      selectedExtras={bookingState.selectedExtras}
                      isConfirming={isConfirming}
                      isConfirmationPage={true}
                      onApplyCoupon={() => {}} // No-op on this page
                      onRemoveCoupon={() => {}} // No-op on this page
                    />
                </aside>
            </div>
        </div>
    );
}
