
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, addDays, differenceInDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

import type { Package } from '@/types/package';
import type { RoomType } from '@/types/roomType';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import type { SelectedRoom, GuestSelection } from '@/components/booking/types';
import { useRouter, useParams } from 'next/navigation';

interface PackageSelectionProps {
    packages: Package[];
    roomTypes: (RoomType & { availableUnits?: number })[];
    services: Service[];
    mealPlans: MealPlan[];
    currency: string;
    onBookPackage: (pkg: Package, roomTypeId: string, dateRange: DateRange) => void;
    dateRange?: DateRange;
}

const PackageCard = ({ pkg, roomTypes, services, mealPlans, currency, onBookPackage, searchDateRange }: { pkg: Package, roomTypes: (RoomType & { availableUnits?: number })[], services: Service[], mealPlans: MealPlan[], currency: string, onBookPackage: (pkg: Package, roomTypeId: string, dateRange: DateRange) => void, searchDateRange?: DateRange }) => {
    const { t } = useTranslation('booking_packages');
    const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>(pkg.includedRoomTypeIds[0] || '');
    
    // Correctly initialize state from props
    const [date, setDate] = useState<Date | undefined>(searchDateRange?.from);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(searchDateRange);

    useEffect(() => {
      setDate(searchDateRange?.from);
      setDateRange(searchDateRange);
    }, [searchDateRange]);


    const includedRoomTypes = roomTypes.filter(rt => pkg.includedRoomTypeIds.includes(rt.id));
    const includedServices = services.filter(s => pkg.includedServiceIds.includes(s.id));
    const includedMealPlans = mealPlans.filter(mp => pkg.includedMealPlanIds.includes(mp.id));
    
    const isFixedNights = pkg.packageType === 'fixed_nights';
    const nights = isFixedNights ? pkg.numberOfNights || 1 : (dateRange?.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0);
    
    let priceDisplay: string;
    if (pkg.packageType === 'fixed_nights') {
        const guestText = pkg.numberOfGuests ? t('price_display.for_guests', { count: pkg.numberOfGuests }) : '';
        const nightsText = pkg.numberOfNights ? t('price_display.per_nights', { count: pkg.numberOfNights }) : '';
        priceDisplay = `${currency}${pkg.price.toFixed(2)} ${guestText}${nightsText}`;
    } else if (pkg.packageType === 'per_night') {
        const guestText = ` ${t('price_display.up_to_guests', { count: pkg.numberOfGuests })}`;
        priceDisplay = `${currency}${pkg.price.toFixed(2)}${t('price_display.per_night')}${guestText}`;
    } else { // per_guest_per_night
        const guestText = ` ${t('price_display.up_to_guests', { count: pkg.numberOfGuests })}`;
        priceDisplay = `${currency}${pkg.price.toFixed(2)}${t('price_display.per_guest_per_night')}${guestText}`;
    }

    const handleBooking = () => {
        if (!selectedRoomTypeId) {
            toast({ title: t('toasts.select_room_type'), variant: "destructive" });
            return;
        }

        let finalDateRange: DateRange | undefined;
        if (isFixedNights) {
            if (!date) {
                toast({ title: t('toasts.select_checkin_date'), variant: "destructive" });
                return;
            }
            finalDateRange = { from: date, to: addDays(date, nights) };
        } else {
            if (!dateRange || !dateRange.from || !dateRange.to) {
                toast({ title: t('toasts.select_date_range'), variant: "destructive" });
                return;
            }
            if (differenceInDays(dateRange.to, dateRange.from) < 1) {
                toast({ title: t('toasts.select_valid_range'), variant: "destructive" });
                return;
            }
            finalDateRange = dateRange;
        }

        onBookPackage(pkg, selectedRoomTypeId, finalDateRange);
    };

    const isBookable = includedRoomTypes.some(rt => (rt.availableUnits || 0) > 0);

    return (
        <Card className="w-full shadow-md">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-bold font-headline" style={{ color: 'var(--booking-primary)' }}>{pkg.name}</CardTitle>
                        <CardDescription>{pkg.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">{isFixedNights ? t('fixed_stay_badge') : t('flexible_stay_badge')}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h4 className="font-semibold text-sm mb-2">{t('whats_included_title')}</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {includedRoomTypes.length > 0 && <li>{t('accommodation_inclusion', { roomTypeName: includedRoomTypes.map(rt => rt.name).join(' or ') })}</li>}
                        {includedServices.map(s => <li key={s.id}>{s.name}</li>)}
                        {includedMealPlans.map(mp => <li key={mp.id}>{mp.name}</li>)}
                    </ul>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    {includedRoomTypes.length > 1 && (
                         <div className="space-y-1">
                            <Label>{t('choose_room_type_label')}</Label>
                            <Select value={selectedRoomTypeId} onValueChange={setSelectedRoomTypeId}>
                                <SelectTrigger><SelectValue placeholder="Select a room" /></SelectTrigger>
                                <SelectContent>
                                    {includedRoomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                     <div className="space-y-1">
                        <Label>{isFixedNights ? t('checkin_date_label') : t('date_range_label')}</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                                    <Icons.CalendarDays className="mr-2 h-4 w-4" />
                                    {isFixedNights 
                                        ? (date ? format(date, "PPP") : t('checkin_date_placeholder'))
                                        : (dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "PP")} - ${format(dateRange.to, "PP")}` : format(dateRange.from, "PP")) : t('date_range_placeholder'))
                                    }
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode={isFixedNights ? 'single' : 'range'}
                                    selected={isFixedNights ? date : dateRange}
                                    onSelect={isFixedNights ? setDate : setDateRange as any}
                                    initialFocus
                                    disabled={{ before: new Date() }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
                <p className="font-bold text-lg">{priceDisplay}</p>
                <Button onClick={handleBooking} className="bg-[var(--booking-primary)] text-white hover:bg-[var(--booking-primary-hover)]" disabled={!isBookable}>
                    {isBookable ? t('book_package_button') : t('not_available_button')}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function PackageSelection({ packages, roomTypes, services, mealPlans, currency, onBookPackage, dateRange }: PackageSelectionProps) {
    const { t } = useTranslation('booking_packages');
    const activePackages = packages.filter(p => p.active);
    
    if (activePackages.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p>{t('empty_state')}</p>
            </div>
        );
    }
    return (
        <div className="space-y-6 mt-6">
            {activePackages.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} roomTypes={roomTypes} services={services} mealPlans={mealPlans} currency={currency} onBookPackage={onBookPackage} searchDateRange={dateRange} />
            ))}
        </div>
    );
}
