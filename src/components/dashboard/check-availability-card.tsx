
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, startOfDay, differenceInDays, eachDayOfInterval, addDays, parseISO, isWithinInterval } from "date-fns";
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";
import { toast } from '@/hooks/use-toast';

import type { RoomType } from '@/types/roomType';
import type { Room as FirestoreRoom } from '@/types/room';
import type { Reservation, ReservationRoom } from '@/components/calendar/types';
import type { RatePlan } from '@/types/ratePlan';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Property } from '@/types/property';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface CheckAvailabilityCardProps {
  propertyId: string | null;
  propertySettings: Property | null;
  onBook?: (prefillData: Partial<Reservation>) => void;
}

interface AvailabilityResult {
  roomTypeId: string;
  roomTypeName: string;
  roomId: string;
  roomName: string;
  status: 'Available' | 'Occupied';
  statusMessage?: string;
  maxGuests: number;
  defaultRatePlanId: string;
  defaultRatePlanName: string;
  defaultRatePlanPrice: number;
}


export default function CheckAvailabilityCard({ propertyId, propertySettings, onBook }: CheckAvailabilityCardProps) {
  const { t, i18n } = useTranslation('pages/dashboard/check-availability-card-content');
  const [selectedDates, setSelectedDates] = useState<DateRange | undefined>(() => {
    const today = startOfDay(new Date());
    return { from: today, to: addDays(today, 1) }; 
  });
  const [numAdults, setNumAdults] = useState<number>(2);
  const [numChildren, setNumChildren] = useState<number>(0);

  const [availabilityResults, setAvailabilityResults] = useState<AvailabilityResult[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const locale = i18n.language === 'fr' ? fr : enUS;

  const handleCheckAvailability = useCallback(async () => {
    if (!propertyId || !selectedDates?.from || !selectedDates?.to) {
      setAvailabilityResults([]);
      toast({ title: t('toasts.no_room_types'), description: t('toasts.no_room_types_description'), variant: "default" });
      return;
    }
    setIsLoadingAvailability(true);

    try {
        const functions = getFunctions(app, "europe-west1");
        const checkAvailabilityFn = httpsCallable(functions, "checkAvailability");
      const response: any = await checkAvailabilityFn({
        propertySlug: propertySettings?.slug,
        startDate: selectedDates.from.toISOString(),
        endDate: selectedDates.to.toISOString(),
        adults: numAdults,
        children: numChildren,
      });
        
        const result = response.data;
        const availableTypes: { id: string; name: string; maxGuests: number, availableRooms: {id: string, name: string}[] }[] = result.availableRoomTypes || [];
        
        // Fetch rate plans for the room types
        const ratePlansQuery = query(collection(db, 'ratePlans'), where('propertyId', '==', propertyId));
        const ratePlansSnap = await getDocs(ratePlansQuery);
        const ratePlansMap = new Map<string, RatePlan[]>();
        
        ratePlansSnap.docs.forEach(doc => {
          const ratePlan = { id: doc.id, ...doc.data() } as RatePlan;
          if (!ratePlansMap.has(ratePlan.roomTypeId)) {
            ratePlansMap.set(ratePlan.roomTypeId, []);
          }
          ratePlansMap.get(ratePlan.roomTypeId)!.push(ratePlan);
        });
        
        const mappedResults = availableTypes.flatMap(rt => {
          // Get the default rate plan (usually the first one or marked as default)
          const ratePlans = ratePlansMap.get(rt.id) || [];
          const defaultRatePlan = ratePlans.find((rp: RatePlan) => rp.default) || ratePlans[0];
          const price = defaultRatePlan?.basePrice || (defaultRatePlan?.pricingPerGuest ? Object.values(defaultRatePlan.pricingPerGuest)[0] : 0) || 0;
          
          return rt.availableRooms.map(room => ({
                roomTypeId: rt.id,
                roomTypeName: rt.name,
                roomId: room.id,
                roomName: room.name,
                status: 'Available' as const,
                maxGuests: rt.maxGuests,
                defaultRatePlanId: defaultRatePlan?.id || '',
                defaultRatePlanName: defaultRatePlan?.planName || 'Standard',
                defaultRatePlanPrice: price,
            }));
        });

        setAvailabilityResults(mappedResults);

    } catch (err) {
        console.error("Error checking availability:", err);
        toast({ title: "Availability Check Failed", description: (err as Error).message || "Could not retrieve available rooms.", variant: "destructive" });
        setAvailabilityResults([]);
    } finally {
        setIsLoadingAvailability(false);
    }

  }, [propertyId, selectedDates, numAdults, propertySettings?.slug, t]);

  const handleBook = (result: AvailabilityResult) => {
    if (!onBook || !selectedDates?.from || !selectedDates?.to) return;
    
    // Calculate the total price for all nights
    const nights = differenceInDays(selectedDates.to, selectedDates.from);
    const totalPrice = result.defaultRatePlanPrice * nights;
    
    const roomSelection: ReservationRoom = {
      roomId: result.roomId,
      roomName: result.roomName,
      roomTypeId: result.roomTypeId,
      roomTypeName: result.roomTypeName,
      ratePlanId: result.defaultRatePlanId,
      ratePlanName: result.defaultRatePlanName,
      price: totalPrice,
      adults: numAdults,
      children: numChildren,
      selectedExtras: [],
    };
    
    onBook({
      rooms: [roomSelection],
      startDate: selectedDates.from,
      endDate: selectedDates.to,
    });
  };

  const handleClearSearch = () => {
    setAvailabilityResults([]);
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection */}
        <div className="space-y-2">
          <Label htmlFor="availabilityDateRange" className="text-sm font-semibold text-slate-700">
            {t('dates_label')}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="availabilityDateRange"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal h-11", !selectedDates && "text-muted-foreground")}
              >
                <Icons.CalendarDays className="mr-2 h-4 w-4" />
                {selectedDates?.from ? (
                  selectedDates.to ? (
                    <>{format(selectedDates.from, "PP", { locale })} - {format(selectedDates.to, "PP", { locale })}</>
                  ) : (format(selectedDates.from, "PP", { locale }))
                ) : (<span>{t('dates_placeholder')}</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar locale={locale} mode="range" selected={selectedDates} onSelect={setSelectedDates} numberOfMonths={2} initialFocus defaultMonth={selectedDates?.from} disabled={{ before: startOfDay(new Date()) }}/>
            </PopoverContent>
          </Popover>
        </div>

        {/* Guest Count */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">{t('guests_label')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-11">
                <span className="flex items-center">
                  <Icons.Users className="mr-2 h-4 w-4 text-slate-500" />
                  <span className="text-sm">{numAdults} Adults · {numChildren} Children</span>
                </span>
                <Icons.DropdownArrow className="h-4 w-4 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="numAdultsCheck" className="text-sm font-medium">{t('adults_label')}</Label>
                  <Input id="numAdultsCheck" type="number" min={1} value={numAdults} onChange={(e) => setNumAdults(Math.max(1, parseInt(e.target.value) || 1))} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="numChildrenCheck" className="text-sm font-medium">{t('children_label')}</Label>
                  <Input id="numChildrenCheck" type="number" min={0} value={numChildren} onChange={(e) => setNumChildren(Math.max(0, parseInt(e.target.value) || 0))} className="mt-2" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Check Availability Button */}
        <Button onClick={handleCheckAvailability} disabled={isLoadingAvailability} className="w-full h-11 bg-[#003166] hover:bg-[#002147]">
          {isLoadingAvailability ? (
            <><Icons.Spinner className="mr-2 h-4 w-4 animate-spin" /> {t('checking_button')}</>
          ) : (
            <><Icons.Search className="mr-2 h-4 w-4" /> {t('check_availability_button')}</>
          )}
        </Button>

        {/* Loading State */}
        {isLoadingAvailability && (
          <div className="flex flex-col justify-center items-center py-8">
            <Icons.Spinner className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{t('checking_availability')}</p>
          </div>
        )}

        {/* Results */}
        {!isLoadingAvailability && availabilityResults.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Available Rooms</h3>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {availabilityResults.length} {availabilityResults.length === 1 ? 'room' : 'rooms'}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="h-7 text-xs text-slate-500 hover:text-slate-700"
              >
                <Icons.X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availabilityResults.map(result => (
                <div key={result.roomId} className="p-4 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-800">{result.roomName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{result.roomTypeName}</p>
                    </div>
                    <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      {t(`status.${result.status.toLowerCase()}`)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Icons.Users className="h-3.5 w-3.5" />
                        <span>Up to {result.maxGuests}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        <span>{propertySettings?.currency || '$'}{(result.defaultRatePlanPrice || 0).toFixed(2)}</span>
                        <span className="text-slate-500 font-normal">/night</span>
                      </div>
                    </div>
                    
                    {result.status === 'Available' && onBook && (
                      <Button
                        size="sm"
                        onClick={() => handleBook(result)}
                        className="bg-[#003166] hover:bg-[#002147] h-8 text-xs"
                      >
                        {t('action.book_now')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
