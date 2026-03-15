
"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Icons } from '@/components/icons';
import { toast } from '@/hooks/use-toast';
import { differenceInDays, startOfDay, parseISO, format, addDays } from 'date-fns';
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
import BookingSearchBar from '@/components/booking/booking-search-bar';

const GuestDetailsForm = dynamic(() => import('@/components/booking/guest-details-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const ExtrasSelection = dynamic(() => import('@/components/booking/extras-selection'), {
    loading: () => <div className="h-64 flex items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
});


export default function ExtrasPage() {
    const router = useRouter();
    const params = useParams();
    const propertySlug = params.propertySlug as string;
    const { t, i18n } = useTranslation(['booking_extras', 'booking_confirmation']);
    const locale = i18n.language === 'fr' ? fr : enUS;

    const [bookingState, setBookingState] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [property, setProperty] = useState<Property | null>(null);
    const [services, setServices] = useState<any[]>([]);
    const [mealPlans, setMealPlans] = useState<any[]>([]);
    const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([]);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            if (!propertySlug) return;
            try {
                const functions = getFunctions(app, 'europe-west1');
                const fetchBookingPageData = httpsCallable(functions, 'fetchBookingPageData');
                const result = await fetchBookingPageData({ propertySlug });
                const data = result.data as any;

                if (!data.success) throw new Error(data.error || "Failed to fetch property data.");

                setProperty(data.property);
                setServices(data.services || []);
                setMealPlans(data.mealPlans || []);

            } catch (error) {
                console.error("Failed to fetch property data:", error);
                toast({ title: "Error", description: "Could not load property details.", variant: "destructive" });
                router.replace(`/booking/${propertySlug}`);
            }
        };

        const loadBookingState = () => {
            try {
                const storedState = localStorage.getItem('bookingState');
                if (storedState) {
                    const parsedState = JSON.parse(storedState);
                    if (parsedState.dateRange?.from) parsedState.dateRange.from = parseISO(parsedState.dateRange.from);
                    if (parsedState.dateRange?.to) parsedState.dateRange.to = parseISO(parsedState.dateRange.to);
                    setBookingState(parsedState);
                    setSelectedExtras(parsedState.selectedExtras || []);
                } else {
                    toast({ title: t('booking_confirmation:toasts.session_not_found_title'), description: t('booking_confirmation:toasts.session_not_found_description'), variant: "destructive" });
                    router.replace(`/booking/${propertySlug}`);
                }
            } catch (error) {
                console.error("Failed to parse booking state:", error);
                router.replace(`/booking/${propertySlug}`);
            }
        };

        fetchData();
        loadBookingState();
        setIsLoading(false);

    }, [propertySlug, router, t]);

    const calculateExtraItemTotal = useCallback((extra: SelectedExtra) => {
        if (!bookingState?.dateRange?.from || !bookingState?.dateRange?.to) return 0;
        const nights = differenceInDays(startOfDay(bookingState.dateRange.to), startOfDay(bookingState.dateRange.from));
        const totalGuests = bookingState.guests.adults + bookingState.guests.children;
        let itemTotal = 0;
        const { price: unitPrice, quantity, unit } = extra;
        switch(unit) {
            case 'one_time':
            case 'per_booking':
            case 'one_time_per_room':
                itemTotal = unitPrice * quantity; break;
            case 'per_night':
            case 'per_night_per_room':
                itemTotal = unitPrice * nights * quantity; break;
            case 'per_guest':
            case 'one_time_per_guest':
                itemTotal = unitPrice * totalGuests * quantity; break;
            case 'per_night_per_guest':
                itemTotal = unitPrice * nights * totalGuests * quantity; break;
            default:
                itemTotal = unitPrice * quantity;
        }
        return itemTotal;
    }, [bookingState]);
    
    const priceDetails = useMemo(() => {
        if (!bookingState?.dateRange?.from || !bookingState?.dateRange?.to) return null;
        
        const nights = differenceInDays(startOfDay(bookingState.dateRange.to), startOfDay(bookingState.dateRange.from));

        const calculatedExtras = selectedExtras.map(extra => ({
            ...extra,
            total: calculateExtraItemTotal(extra)
        }));
        const extrasTotal = calculatedExtras.reduce((sum, extra) => sum + extra.total, 0);
        
        const newSubtotal = (bookingState.roomsTotal || 0) + extrasTotal;
        
        let newDiscountAmount = 0;
        if (bookingState.appliedPromotion) {
            const promotion = bookingState.appliedPromotion;
            if (promotion.discountType === 'percentage') {
                newDiscountAmount = newSubtotal * (promotion.discountValue / 100);
            } else { // flat_rate - discount is based on nights and number of rooms
                newDiscountAmount = (promotion.discountValue || 0) * nights * bookingState.selections.length;
            }
        }
        
        const newNetAmount = newSubtotal - newDiscountAmount;
        const taxRate = (property?.taxSettings?.enabled && property.taxSettings.rate) ? property.taxSettings.rate / 100 : 0;
        const newTaxAmount = newNetAmount * taxRate;
        const newTotalPrice = newNetAmount + newTaxAmount;

        return {
            ...bookingState,
            selectedExtras: calculatedExtras,
            extrasTotal,
            subtotal: newSubtotal,
            discountAmount: newDiscountAmount,
            netAmount: newNetAmount,
            taxAmount: newTaxAmount,
            totalPrice: newTotalPrice,
            // Carry over the original price before any discounts
            priceBeforeDiscount: newSubtotal,
            // Ensure appliedPromotion is carried over
            appliedPromotion: bookingState.appliedPromotion,
        };
    }, [bookingState, selectedExtras, property, calculateExtraItemTotal]);


    const handleContinue = () => {
        const newState = {
            ...bookingState,
            ...priceDetails,
        };
        localStorage.setItem('bookingState', JSON.stringify(newState));
        router.push(`/booking/${propertySlug}/confirmation`);
    };


    if (isLoading || !bookingState || !property) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Icons.Spinner className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-[1500px] mx-auto p-8">
            <header className="mb-8">
                 {bookingState && (
                    <BookingSearchBar
                        dateRange={bookingState.dateRange}
                        onDateRangeChange={(range) => {
                            const newBookingState = { ...bookingState, dateRange: range };
                            setBookingState(newBookingState);
                            localStorage.setItem('bookingState', JSON.stringify(newBookingState));
                            router.push(`/booking/${propertySlug}?checkin=${format(range?.from || new Date(), 'yyyy-MM-dd')}&checkout=${format(range?.to || addDays(new Date(), 1), 'yyyy-MM-dd')}&adults=${bookingState.guests.adults}`);
                        }}
                        guests={bookingState.guests}
                        onGuestsChange={(guests) => {
                           const newBookingState = { ...bookingState, guests };
                            setBookingState(newBookingState);
                            localStorage.setItem('bookingState', JSON.stringify(newBookingState));
                        }}
                        onSearch={() => router.push(`/booking/${propertySlug}?checkin=${format(bookingState.dateRange.from, 'yyyy-MM-dd')}&checkout=${format(bookingState.dateRange.to, 'yyyy-MM-dd')}&adults=${bookingState.guests.adults}`)}
                    />
                 )}
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <main className="lg:col-span-2 space-y-6">
                    <ExtrasSelection
                        services={services}
                        mealPlans={mealPlans}
                        selectedExtras={selectedExtras}
                        onExtrasChange={setSelectedExtras}
                        nights={bookingState.nights}
                        guests={bookingState.guests.adults + bookingState.guests.children}
                        currency={property.currency || '$'}
                    />
                </main>
                <aside className="lg:col-span-1 space-y-6 sticky top-24">
                    <BookingSummary 
                        selections={bookingState.selections}
                        dateRange={bookingState.dateRange}
                        guests={bookingState.guests}
                        currency={property?.currency || '$'}
                        property={property}
                        onContinue={handleContinue}
                        priceDetails={priceDetails}
                        allPromotions={[]}
                        selectedExtras={priceDetails?.selectedExtras}
                        onRemoveExtra={(extraId) => setSelectedExtras(prev => prev.filter(e => e.id !== extraId))}
                        onApplyCoupon={() => {}}
                        onRemoveCoupon={() => {}}
                    />
                </aside>
            </div>
        </div>
    );
}
