
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { addDays, differenceInDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { toast } from '@/hooks/use-toast';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import Types
import type { Property } from '@/types/property';
import type { RoomType } from '@/types/roomType';
import type { RatePlan } from '@/types/ratePlan';
import type { Promotion } from '@/types/promotion';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import type { Package } from '@/types/package';

// Import Components
import BookingSearchBar from '@/components/booking/booking-search-bar';
import BookingSummary from '@/components/booking/booking-summary';
import PropertyInfoCard from '@/components/booking/property-info-card';
import { type SelectedRoom, type GuestSelection } from '@/components/booking/types';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import type { SelectedExtra } from '@/components/calendar/types';
import PromotionPopup from '@/components/booking/promotion-popup';

const RoomSelection = dynamic(() => import('@/components/booking/room-selection'), {
  loading: () => <div className="h-64 flex items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
});
const PackageSelection = dynamic(() => import('@/components/booking/package-selection'), {
  loading: () => <div className="h-64 flex items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
});

interface AvailableRoomType extends RoomType {
    availableUnits: number;
    cheapestRate: number;
    ratePlans: RatePlan[];
    availableRooms?: { id: string, name: string }[];
}

function PublicBookingPageComponent() {
  const params = useParams();
  const router = useRouter();
  const propertySlug = params.propertySlug as string;
  const searchParams = useSearchParams();
  const { t } = useTranslation('booking');

  // Data state
  const [property, setProperty] = useState<Property | null>(null);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [allPromotions, setAllPromotions] = useState<Promotion[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  
  const [availableRoomTypes, setAvailableRoomTypes] = useState<AvailableRoomType[]>([]);

  // UI & Form state
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [guests, setGuests] = useState<GuestSelection>({ adults: 1, children: 0, rooms: 1 });
  const [selections, setSelections] = useState<SelectedRoom[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Promotion | null>(null);
  
  // Initialize state from URL search params
  const checkin = searchParams.get('checkin');
  const checkout = searchParams.get('checkout');
  const adults = searchParams.get('adults');
  
  useEffect(() => {
    const fromDate = checkin && isValid(parseISO(checkin)) ? parseISO(checkin) : new Date();
    const toDate = checkout && isValid(parseISO(checkout)) ? parseISO(checkout) : addDays(fromDate, 1);

    setDateRange({ from: fromDate, to: toDate });
    setGuests(prev => ({
        ...prev,
        adults: adults ? parseInt(adults, 10) : 1,
    }));
  }, [checkin, checkout, adults]);

  const checkAvailability = useCallback(async (
    range: DateRange | undefined,
    guestSelection: GuestSelection
  ) => {
    if (!range?.from || !range?.to) return;
    setIsCheckingAvailability(true);
    
    const nights = differenceInDays(range.to, range.from);
    if(nights <= 0) {
        toast({ title: "Invalid Date Range", description: "Check-out date must be after check-in date.", variant: "destructive" });
        setIsCheckingAvailability(false);
        return;
    }

    try {
        const functions = getFunctions(app, "europe-west1");
        const checkAvailabilityFn = httpsCallable(functions, "checkAvailability");
        const response: any = await checkAvailabilityFn({
            propertySlug,
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            adults: guestSelection.adults,
            children: guestSelection.children,
            nights,
        });

        const data = response.data;
        if (data.error) {
            throw new Error(data.error);
        }

        setAvailableRoomTypes(data.availableRoomTypes || []);

    } catch (err: any) {
        console.error("Error checking availability:", err);
        toast({ title: "Availability Check Failed", description: err.message || "Could not retrieve available rooms.", variant: "destructive" });
        setAvailableRoomTypes([]);
    } finally {
        setIsCheckingAvailability(false);
    }
  }, [propertySlug]);

  useEffect(() => {
    if (!propertySlug) {
      setError("Property identifier is missing.");
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const functions = getFunctions(app, 'europe-west1');
        const fetchBookingPageData = httpsCallable(functions, 'fetchBookingPageData');
        const result = await fetchBookingPageData({ propertySlug });
        
        const data = result.data as any;
        
        if (!data.success) {
            throw new Error(data.error || "An unknown error occurred.");
        }
        
        setProperty(data.property);
        setRatePlans(data.ratePlans);
        setAllPromotions(data.promotions.map((p: any) => ({ ...p, startDate: new Date(p.startDate), endDate: new Date(p.endDate) })));
        setPackages(data.packages);
        setServices(data.services);
        setMealPlans(data.mealPlans);
        
      } catch (err: any) {
        console.error("Error fetching booking page data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
        toast({ title: "Error", description: "Could not load property data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [propertySlug]);
  
  useEffect(() => {
    if (!isLoading && dateRange?.from && dateRange?.to) {
        checkAvailability(dateRange, guests);
    }
  }, [isLoading, dateRange, guests, checkAvailability]);

  const handleAddRoom = (roomType: AvailableRoomType, ratePlan: RatePlan, promotion?: Promotion) => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Error", description: "Please select dates first.", variant: "destructive" });
      return;
    }
    
    if (selections.length >= guests.rooms) {
      toast({ title: "Limit Reached", description: `You have already selected the desired number of rooms (${guests.rooms}). Adjust the search if you need more.`, variant: "default" });
      return;
    }
  
    const availablePhysicalRooms = roomType.availableRooms || [];
    if (availablePhysicalRooms.length === 0) {
      toast({ title: "Error", description: "No specific rooms available for this type.", variant: "destructive" });
      return;
    }
  
    const alreadySelectedRoomIds = new Set(selections.map(s => s.roomId));
    const roomToBook = availablePhysicalRooms.find(r => !alreadySelectedRoomIds.has(r.id));
  
    if (!roomToBook) {
      toast({ title: "All available rooms of this type are already in your selection.", variant: "destructive" });
      return;
    }
  
    const nights = differenceInDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
    if (nights <= 0) {
        toast({ title: "Invalid Date Range", description: "Check-out date must be after check-in date.", variant: "destructive" });
        return;
    }
    let pricePerNight = 0;
  
    if (ratePlan.pricingMethod === 'per_night') {
      pricePerNight = ratePlan.basePrice ?? roomType.baseRate ?? 0;
    } else { // 'per_guest'
      if (ratePlan.pricingPerGuest) {
        pricePerNight = ratePlan.pricingPerGuest[guests.adults.toString()] ?? (ratePlan.pricingPerGuest['1'] ?? roomType.baseRate ?? 0);
      }
    }
    
    const priceBeforeDiscount = pricePerNight * nights;
  
    const newSelection: SelectedRoom = {
      selectionId: `${roomType.id}-${ratePlan.id}-${Date.now()}`,
      roomId: roomToBook.id,
      roomName: roomToBook.name,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      ratePlanId: ratePlan.id,
      ratePlanName: ratePlan.planName,
      guests: { adults: guests.adults, children: guests.children },
      nights,
      price: priceBeforeDiscount,
      priceBeforeDiscount,
      promotionApplied: promotion ? { id: promotion.id, name: promotion.name, discountAmount: 0, discountType: promotion.discountType, discountValue: promotion.discountValue } : undefined,
    };
    setSelections(prev => [...prev, newSelection]);
    toast({ title: "Room Added", description: `${roomType.name} has been added to your booking.` });
  };
  
  const handleBookPackage = useCallback((pkg: Package, roomTypeId: string, selectedDateRange: DateRange) => {
    if (!selectedDateRange?.from || !selectedDateRange?.to) {
        toast({title: "Error", description: "Please select a valid date range for the package.", variant: "destructive"});
        return;
    }

    const roomType = availableRoomTypes.find(rt => rt.id === roomTypeId);
    if (!roomType || !roomType.availableRooms || roomType.availableRooms.length === 0) {
        toast({title: "Not Available", description: "No rooms available for this package's room type in the selected dates.", variant: "destructive"});
        return;
    }

    const roomToBook = roomType.availableRooms[0];
    const nights = differenceInDays(startOfDay(selectedDateRange.to), startOfDay(selectedDateRange.from));

    let finalPackagePrice = 0;
    const numGuests = pkg.numberOfGuests || guests.adults || 1;

    switch (pkg.packageType) {
        case 'fixed_nights':
            finalPackagePrice = pkg.price;
            break;
        case 'per_night':
            finalPackagePrice = pkg.price * nights;
            break;
        case 'per_guest_per_night':
            finalPackagePrice = pkg.price * numGuests * nights;
            break;
        default:
            finalPackagePrice = pkg.price;
    }

    const selection: SelectedRoom = {
        selectionId: `${pkg.id}-${roomTypeId}-${Date.now()}`,
        roomId: roomToBook.id,
        roomName: roomToBook.name,
        roomTypeId: roomTypeId,
        roomTypeName: roomType.name,
        ratePlanId: `package-${pkg.id}`,
        ratePlanName: `Package: ${pkg.name}`,
        guests: { adults: numGuests, children: 0 },
        nights: nights,
        price: finalPackagePrice,
        priceBeforeDiscount: finalPackagePrice,
        packageDetails: {
            id: pkg.id,
            name: pkg.name,
            includedServiceIds: pkg.includedServiceIds,
            includedMealPlanIds: pkg.includedMealPlanIds,
        }
    };
    
    const taxRate = (property?.taxSettings?.enabled && property.taxSettings.rate) ? property.taxSettings.rate / 100 : 0;
    const taxAmount = finalPackagePrice * taxRate;
    
    const bookingState = {
        selections: [selection],
        dateRange: selectedDateRange,
        guests: { adults: numGuests, children: 0, rooms: 1 },
        nights,
        currency: property?.currency || '$',
        taxSettings: property?.taxSettings,
        defaultBookingStatus: property?.bookingPageSettings?.defaultBookingStatus || 'Pending',
        roomsTotal: finalPackagePrice,
        extrasTotal: 0,
        subtotal: finalPackagePrice,
        discountAmount: 0,
        netAmount: finalPackagePrice,
        taxAmount: taxAmount,
        totalPrice: finalPackagePrice + taxAmount,
        priceBeforeDiscount: finalPackagePrice,
        appliedPromotion: null,
    };

    localStorage.setItem('bookingState', JSON.stringify(bookingState));
    router.push(`/booking/${propertySlug}/confirmation`);
  }, [propertySlug, router, availableRoomTypes, property, guests.adults]);

  const handleRemoveRoom = (selectionId: string) => {
    setSelections(prev => prev.filter(s => s.selectionId !== selectionId));
  };
  
  const handleApplyCoupon = (code: string) => {
    if (!code.trim()) return;

    const applicableCoupon = allPromotions.find(p => 
        p.couponCode?.toUpperCase() === code.trim().toUpperCase() &&
        dateRange?.from && dateRange.to &&
        dateRange.from < p.endDate &&
        dateRange.to > p.startDate &&
        selections.some(sel => p.ratePlanIds.includes(sel.ratePlanId))
    );

    if (applicableCoupon) {
      setAppliedCoupon(applicableCoupon);
      toast({ title: "Coupon Applied", description: `Promotion "${applicableCoupon.name}" has been applied.` });
    } else {
      toast({ title: "Invalid Coupon", description: "The entered coupon code is not valid or cannot be applied to your selection.", variant: "destructive" });
    }
  };

  const handleRemoveCoupon = () => {
      setAppliedCoupon(null);
      toast({ title: "Coupon Removed", description: "The coupon has been removed from your booking." });
  };

  const priceDetails = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    const nights = differenceInDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
    if (nights <= 0) return null;

    const roomsTotal = selections.reduce((acc, sel) => acc + (sel.priceBeforeDiscount || 0), 0);
    const subtotal = roomsTotal; // On this page, subtotal is just rooms total

    // Determine which promotion to use: automatic or coupon
    let finalAppliedPromotion: Promotion | null = null;
    let automaticPromotion: Promotion | null = null;

    if (selections.length > 0) {
      const firstSelection = selections[0];
      if (firstSelection?.ratePlanId) {
        automaticPromotion = allPromotions.find(p => 
          !p.couponCode &&
          p.ratePlanIds.includes(firstSelection.ratePlanId) &&
          dateRange.from! < p.endDate &&
          dateRange.to! > p.startDate
        ) || null;
      }
    }
    
    finalAppliedPromotion = appliedCoupon || automaticPromotion;
    
    let discountAmount = 0;
    if (finalAppliedPromotion) {
        if (finalAppliedPromotion.discountType === 'percentage') {
            discountAmount = subtotal * (finalAppliedPromotion.discountValue / 100);
        } else { // flat_rate
            discountAmount = finalAppliedPromotion.discountValue * nights * selections.length;
        }
    }

    const netAmount = subtotal - discountAmount;
    const taxRate = (property?.taxSettings?.enabled && property.taxSettings.rate) ? property.taxSettings.rate / 100 : 0;
    const taxAmount = netAmount * taxRate;
    const totalPrice = netAmount + taxAmount;
    
    return {
      roomsTotal,
      extrasTotal: 0,
      subtotal,
      discountAmount,
      netAmount,
      taxAmount,
      totalPrice,
      priceBeforeDiscount: roomsTotal,
      appliedPromotion: finalAppliedPromotion ? { ...finalAppliedPromotion } : null,
    };
  }, [selections, dateRange, allPromotions, property, appliedCoupon]);


  const handleContinue = () => {
    if (!priceDetails || selections.length === 0 || !dateRange) return;

    const nights = differenceInDays(startOfDay(dateRange!.to!), startOfDay(dateRange!.from!));
    if (nights <= 0) {
        toast({ title: "Invalid Date Range", description: "Check-out date must be after check-in date.", variant: "destructive" });
        return;
    }

    const bookingState = {
        selections,
        dateRange,
        guests,
        nights,
        currency: property?.currency || '$',
        taxSettings: property?.taxSettings,
        defaultBookingStatus: property?.bookingPageSettings?.defaultBookingStatus || 'Pending',
        requireGuestPhone: property?.bookingPageSettings?.requireGuestPhone || false,
        ...priceDetails,
        selectedExtras: [], 
        extrasTotal: 0,
    };
    
    try {
      localStorage.setItem('bookingState', JSON.stringify(bookingState));
      const hasExtras = services.length > 0 || mealPlans.length > 0;
      if (hasExtras) {
        router.push(`/booking/${propertySlug}/extras`);
      } else {
        router.push(`/booking/${propertySlug}/confirmation`);
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not save your selections.", variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.Spinner className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-destructive text-center">
        <div>
            <Icons.AlertCircle className="mx-auto h-12 w-12" />
            <h2 className="mt-4 text-xl font-bold">Failed to load booking page</h2>
            <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {property?.bookingPageSettings?.promoCard && <PromotionPopup settings={property.bookingPageSettings.promoCard} promotions={allPromotions} />}
      
      <div className="relative h-[30vh] md:h-[40vh] w-full bg-muted group">
        {property?.bookingPageSettings?.heroImageUrl ? (
            <Image 
                src={property.bookingPageSettings.heroImageUrl} 
                alt="Hero Banner" 
                fill
                style={{ objectFit: "cover" }}
                data-ai-hint="hotel exterior"
                priority
            />
        ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-t from-background to-muted">
                <h1 className="text-4xl md:text-6xl font-bold text-center text-foreground/80 tracking-tight">{property?.name}</h1>
            </div>
        )}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
      
      <div className="relative z-20 w-full max-w-6xl px-4 md:px-8 mx-auto -mt-12">
        <div className="bg-card p-4 rounded-xl shadow-2xl border">
          <BookingSearchBar 
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              guests={guests}
              onGuestsChange={setGuests}
              onSearch={() => checkAvailability(dateRange, guests)}
          />
        </div>
      </div>


      <div className="w-full max-w-[1500px] mx-auto p-8 font-body mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <main className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="reservation" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-auto rounded-lg">
                <TabsTrigger value="reservation" className="text-base rounded-md data-[state=active]:bg-[var(--booking-primary)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">{t('tabs.reservation')}</TabsTrigger>
                <TabsTrigger value="packages" className="text-base rounded-md data-[state=active]:bg-[var(--booking-primary)] data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">{t('tabs.packages')}</TabsTrigger>
              </TabsList>
              <TabsContent value="reservation">
                {isCheckingAvailability ? (
                  <div className="flex h-64 items-center justify-center">
                    <Icons.Spinner className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Suspense fallback={<div className="h-64 flex items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
                    <RoomSelection
                      availableRoomTypes={availableRoomTypes}
                      onAddRoom={handleAddRoom}
                      currency={property?.currency || '$'}
                      selections={selections}
                      guests={guests}
                      allPromotions={allPromotions}
                      property={property}
                      dateRange={dateRange}
                    />
                  </Suspense>
                )}
              </TabsContent>
              <TabsContent value="packages">
                 <Suspense fallback={<div className="h-64 flex items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
                    <PackageSelection 
                      packages={packages}
                      roomTypes={availableRoomTypes}
                      services={services}
                      mealPlans={mealPlans}
                      currency={property?.currency || '$'}
                      onBookPackage={handleBookPackage}
                      dateRange={dateRange}
                    />
                 </Suspense>
              </TabsContent>
            </Tabs>
          </main>
          
          <aside className="lg:col-span-1 space-y-6 sticky top-24">
            <BookingSummary
              selections={selections}
              onRemoveRoom={handleRemoveRoom}
              dateRange={dateRange}
              guests={guests}
              currency={property?.currency || '$'}
              property={property}
              onContinue={handleContinue}
              priceDetails={priceDetails}
              allPromotions={allPromotions}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
            />
              {property && <PropertyInfoCard property={property} />}
              <div className="text-center pt-4">
                <p className="text-xs text-muted-foreground">Powered by</p>
                <Link href="/" className="inline-block mt-2">
                  <Image
                    src="/logo.webp"
                    alt="Salnim Pms Logo"
                    width={120}
                    height={30}
                    className="mx-auto"
                    style={{ height: 'auto' }}
                  />
                </Link>
              </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function PublicBookingPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background"><Icons.Spinner className="h-10 w-10 animate-spin text-primary" /></div>}>
            <PublicBookingPageComponent />
        </Suspense>
    )
}
