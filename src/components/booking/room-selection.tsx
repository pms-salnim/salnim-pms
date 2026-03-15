
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Icons } from "@/components/icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


import type { RoomType, Amenity, AmenityCategory } from '@/types/roomType';
import { defaultAmenities, amenityCategories } from '@/types/roomType';
import type { RatePlan } from '@/types/ratePlan';
import { Check, Info, ChevronDown } from 'lucide-react';
import type { SelectedRoom, GuestSelection } from './types';
import { ScrollArea } from '../ui/scroll-area';
import { useTranslation } from 'react-i18next';
import type { Promotion } from '@/types/promotion';
import { differenceInDays, addDays, startOfDay } from 'date-fns';
import type { Property } from '@/types/property';
import { type DateRange } from 'react-day-picker';

interface AvailableRoomType extends RoomType {
  availableUnits: number;
  cheapestRate: number;
  ratePlans: RatePlan[];
  availableRooms?: { id: string, name: string }[];
}

interface RoomSelectionProps {
  availableRoomTypes: AvailableRoomType[];
  onAddRoom: (roomType: AvailableRoomType, ratePlan: RatePlan, promotion?: Promotion) => void;
  currency: string;
  selections: SelectedRoom[];
  guests: GuestSelection;
  allPromotions: Promotion[];
  property: Property | null;
  dateRange: DateRange | undefined;
}

function RatePlanDetail({ 
    roomType, 
    ratePlan, 
    promotions, 
    currency, 
    onAdd,
    isAddButtonDisabled,
    t,
    property,
    dateRange,
    guests,
}: { 
    roomType: AvailableRoomType, 
    ratePlan: RatePlan, 
    promotions: Promotion[],
    currency: string,
    onAdd: (ratePlan: RatePlan, promotion?: Promotion) => void,
    isAddButtonDisabled: boolean,
    t: (key: string, options?: any) => string,
    property: Property | null,
    dateRange: DateRange | undefined,
    guests: GuestSelection,
}) {

  const nights = React.useMemo(() => {
    if (!dateRange?.from || !dateRange.to) return 0;
    const diff = differenceInDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
    return Math.max(0, diff);
  }, [dateRange]);

  let pricePerNight = 0;
  
  if (ratePlan.pricingMethod === 'per_night') {
    pricePerNight = ratePlan.basePrice ?? roomType.baseRate ?? 0;
  } else { // 'per_guest'
    if (ratePlan.pricingPerGuest) {
      const guestCountForRate = Math.min(roomType.maxGuests, Math.max(1, guests.adults));
      pricePerNight = ratePlan.pricingPerGuest[guestCountForRate.toString()] ?? (ratePlan.pricingPerGuest['1'] ?? roomType.baseRate ?? 0);
    }
  }
    
  const priceBeforeDiscount = pricePerNight * nights;

  const applicablePromotion = promotions.find(p => 
      !p.couponCode &&
      p.ratePlanIds.includes(ratePlan.id) &&
      dateRange?.from && dateRange.to &&
      dateRange.from < p.endDate &&
      dateRange.to > p.startDate
  );

  let discountedPrice = priceBeforeDiscount;
  if (applicablePromotion) {
    if (applicablePromotion.discountType === 'percentage') {
      discountedPrice = priceBeforeDiscount * (1 - applicablePromotion.discountValue / 100);
    } else {
      discountedPrice = priceBeforeDiscount - (applicablePromotion.discountValue * nights);
    }
  }
  
  const finalPriceBeforeTax = Math.max(0, discountedPrice);
  
  const taxRate = (property?.taxSettings?.enabled && property.taxSettings.rate) ? property.taxSettings.rate / 100 : 0;
  const taxAmount = finalPriceBeforeTax * taxRate;
  const finalPriceWithTax = finalPriceBeforeTax + taxAmount;


  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-t mt-2 pt-2 first:mt-0 first:border-t-0 first:pt-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
            <AccordionTrigger className="flex-1 w-full p-0 hover:no-underline justify-start group">
                <div className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 text-primary group-data-[state=open]:-rotate-90" />
                    <div className="text-left">
                        <h4 className="font-normal text-foreground">{ratePlan.planName}</h4>
                        {ratePlan.description && <p className="text-xs text-muted-foreground mt-1">{ratePlan.description}</p>}
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                            {Array.from({ length: roomType.maxGuests }).map((_, i) => (
                                <Icons.User key={i} className="h-4 w-4" />
                            ))}
                        </div>
                    </div>
                </div>
            </AccordionTrigger>
            <div className="w-full sm:w-auto flex items-center justify-between gap-4">
                <div className="text-left sm:text-right">
                    {applicablePromotion && (
                        <p className="text-sm font-normal text-destructive line-through">
                            {currency}{priceBeforeDiscount.toFixed(2)}
                        </p>
                    )}
                    <div className="text-xl font-normal text-foreground flex items-center gap-1">
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger>
                                    <span className='flex items-center gap-1'>{currency}{finalPriceWithTax.toFixed(2)} <Info className="h-4 w-4 text-muted-foreground"/></span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('room_selection.total_including_taxes')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    {taxAmount > 0 && <p className="text-xs text-muted-foreground">{t('room_selection.includes_taxes')}</p>}
                </div>
                <div className="w-auto text-center pl-4">
                    <Button 
                      className="w-full sm:w-auto bg-[var(--booking-primary)] text-white hover:bg-[var(--booking-primary-hover)] shrink-0" 
                      onClick={() => onAdd(ratePlan, applicablePromotion)}
                      disabled={isAddButtonDisabled}
                    >
                      {t('room_selection.add_room_button')}
                    </Button>
                </div>
            </div>
        </div>
        <AccordionContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground italic">
                {ratePlan.cancellationPolicy || property?.cancellationPolicy || t('room_selection.no_policy_info')}
            </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}


export default function RoomSelection({ 
    availableRoomTypes, 
    onAddRoom, 
    currency, 
    selections, 
    guests, 
    allPromotions, 
    property,
    dateRange,
}: RoomSelectionProps) {
  const { t } = useTranslation(['booking', 'amenities']);
  const [viewingDetailsFor, setViewingDetailsFor] = useState<AvailableRoomType | null>(null);
  const [openRatePlanId, setOpenRatePlanId] = useState<string | null>(null);

  const getAmenityDetails = (amenityId: string): Amenity | undefined => {
    return defaultAmenities.find(a => a.id === amenityId);
  };
  
  const allImagesForSelectedRoom = [
    ...(viewingDetailsFor?.thumbnailImageUrl ? [viewingDetailsFor.thumbnailImageUrl] : []),
    ...(viewingDetailsFor?.galleryImageUrls || []),
  ];
  
  const calculateCheapestTotal = (roomType: AvailableRoomType): { finalPrice: number; originalPrice?: number } => {
    if (!dateRange?.from || !dateRange.to) {
        return { finalPrice: roomType.cheapestRate };
    }
    
    const nights = differenceInDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
    if (nights <= 0) return { finalPrice: 0 };
    
    let cheapestFinalPrice = Infinity;
    let cheapestOriginalPrice: number | undefined = undefined;

    roomType.ratePlans.forEach(rp => {
        let pricePerNight = 0;
        if (rp.pricingMethod === 'per_night') {
            pricePerNight = rp.basePrice ?? roomType.baseRate ?? 0;
        } else { // 'per_guest'
            if (rp.pricingPerGuest) {
                const guestCountForRate = Math.min(roomType.maxGuests, Math.max(1, guests.adults));
                pricePerNight = rp.pricingPerGuest[guestCountForRate.toString()] ?? (rp.pricingPerGuest['1'] ?? roomType.baseRate ?? 0);
            }
        }
        
        const totalPriceBeforeDiscount = pricePerNight * nights;
        
        const applicablePromotion = allPromotions.find(p => 
            !p.couponCode &&
            p.ratePlanIds.includes(rp.id) &&
            dateRange.from! < p.endDate &&
            dateRange.to! > p.startDate
        );

        let finalPrice = totalPriceBeforeDiscount;
        if (applicablePromotion) {
            if (applicablePromotion.discountType === 'percentage') {
                finalPrice = totalPriceBeforeDiscount * (1 - applicablePromotion.discountValue / 100);
            } else { // flat_rate
                finalPrice = totalPriceBeforeDiscount - (applicablePromotion.discountValue * nights);
            }
        }
        
        finalPrice = Math.max(0, finalPrice);
        
        const taxRate = (property?.taxSettings?.enabled && property.taxSettings.rate) ? property.taxSettings.rate / 100 : 0;
        const finalPriceWithTax = finalPrice * (1 + taxRate);
        const originalPriceWithTax = totalPriceBeforeDiscount * (1 + taxRate);
        
        if (finalPriceWithTax < cheapestFinalPrice) {
            cheapestFinalPrice = finalPriceWithTax;
            if (applicablePromotion) {
                cheapestOriginalPrice = originalPriceWithTax;
            } else {
                cheapestOriginalPrice = undefined; // No discount for this plan
            }
        }
    });

    return { 
        finalPrice: cheapestFinalPrice === Infinity ? roomType.cheapestRate : cheapestFinalPrice,
        originalPrice: cheapestOriginalPrice
    };
  };

  if (availableRoomTypes.length === 0) {
    return (
        <Card className="mt-6">
            <CardContent className="h-[200px] flex flex-col items-center justify-center bg-muted/30 rounded-md text-center">
                <Icons.BedDouble className="w-16 h-16 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">{t('room_selection.no_rooms_title')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t('room_selection.no_rooms_description')}
                </p>
            </CardContent>
        </Card>
    );
  }

  return (
    <>
      <div className="space-y-6 mt-6">
        {availableRoomTypes.map(rt => {
           const countOfThisTypeInSelections = selections.filter(s => s.roomTypeId === rt.id).length;
           const totalRoomsSelected = selections.length;
           const isAddButtonDisabled = 
               countOfThisTypeInSelections >= rt.availableUnits || 
               totalRoomsSelected >= guests.rooms;
               
           const { finalPrice, originalPrice } = calculateCheapestTotal(rt);
           const amenitiesToShow = (rt.selectedAmenities || [])
                .map(id => defaultAmenities.find(a => a.id === id))
                .filter(Boolean) as Amenity[];

           return (
            <Card key={rt.id} className="overflow-hidden shadow-md w-full">
                <div className="flex flex-col md:flex-row">
                    {/* Mobile Image */}
                    <div className="relative flex-shrink-0 w-full h-48 md:hidden group cursor-pointer" onClick={() => setViewingDetailsFor(rt)}>
                        <Image src={rt.thumbnailImageUrl || `https://placehold.co/400x300.png`} alt={rt.name} fill style={{ objectFit: "cover" }} className="h-full w-full group-hover:opacity-80 transition-opacity" data-ai-hint="hotel room" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Eye className="h-8 w-8 text-white" /></div>
                    </div>
                    {/* Desktop Image */}
                    <div className="relative hidden md:block flex-shrink-0 w-64 aspect-[4/3] bg-muted group cursor-pointer" onClick={() => setViewingDetailsFor(rt)}>
                        <Image src={rt.thumbnailImageUrl || `https://placehold.co/400x300.png`} alt={rt.name} fill style={{ objectFit: "cover" }} className="h-full w-full group-hover:opacity-80 transition-opacity" data-ai-hint="hotel room" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Eye className="h-8 w-8 text-white" /></div>
                    </div>
                    
                    <div className="p-4 sm:p-6 flex flex-col md:flex-row flex-grow w-full justify-between items-start">
                      <div className="flex flex-col h-full flex-grow">
                        <CardTitle className="text-2xl font-medium font-headline">{rt.name}</CardTitle>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 my-2 text-muted-foreground text-sm">
                          <TooltipProvider>
                              {amenitiesToShow.slice(0, 5).map(amenity => {
                                  const IconComponent = Icons[amenity.icon as keyof typeof Icons] || Icons.HelpCircle;
                                  return (
                                      <Tooltip key={amenity.id}>
                                          <TooltipTrigger asChild>
                                              <button type="button" aria-label={t(`amenities:${amenity.labelKey}`)}><IconComponent className="h-5 w-5" /></button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>{t(`amenities:${amenity.labelKey}`)}</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  );
                              })}
                          </TooltipProvider>
                          {amenitiesToShow.length > 5 && (
                              <span className="text-xs">+ {amenitiesToShow.length - 5} more</span>
                          )}
                        </div>
                        
                        <div className="flex-grow" />
                        <Button variant="link" className="p-0 h-auto text-sm justify-start underline" onClick={() => setViewingDetailsFor(rt)}>{t('room_selection.more_details_link')}</Button>
                      </div>

                      <div className="w-full md:w-auto flex flex-col items-start md:items-end justify-between h-full mt-4 md:mt-0">
                         <div className="text-left md:text-right">
                            <p className="text-xs text-muted-foreground">{t('room_selection.from_price')}</p>
                            {originalPrice && (
                                <p className="text-sm font-normal text-destructive line-through">
                                    {currency}{originalPrice.toFixed(2)}
                                </p>
                            )}
                            <p className="text-2xl font-bold">{currency}{finalPrice.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{t('room_selection.total_including_taxes')}</p>
                         </div>
                         <div className="w-full md:w-auto mt-2 md:mt-0">
                            <Button variant="outline" className="w-full md:w-auto border-[var(--booking-primary)] text-[var(--booking-primary)] hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground" onClick={() => setOpenRatePlanId(openRatePlanId === rt.id ? null : rt.id)}>
                                {openRatePlanId === rt.id ? t('room_selection.hide_rates_button') : t('room_selection.show_rates_button')}
                            </Button>
                         </div>
                      </div>
                    </div>
                </div>

                {openRatePlanId === rt.id && (
                    <div className="border-t">
                        {(rt.ratePlans || []).map((rp, index) => (
                           <RatePlanDetail
                               key={rp.id}
                               roomType={rt}
                               ratePlan={rp}
                               promotions={allPromotions}
                               currency={currency}
                               onAdd={(plan, promo) => onAddRoom(rt, plan, promo)}
                               isAddButtonDisabled={isAddButtonDisabled}
                               t={t}
                               property={property}
                               dateRange={dateRange}
                               guests={guests}
                           />
                        ))}
                    </div>
                )}
            </Card>
           )
        })}
      </div>

      <Dialog open={!!viewingDetailsFor} onOpenChange={(isOpen) => !isOpen && setViewingDetailsFor(null)}>
        <DialogContent className="sm:max-w-3xl p-0">
          <ScrollArea className="max-h-[90vh] overflow-y-auto pr-1">
            {/* Gallery as Hero */}
             <div className="w-full">
                {allImagesForSelectedRoom.length > 0 ? (
                    <Carousel className="w-full rounded-t-lg overflow-hidden">
                        <CarouselContent>
                            {allImagesForSelectedRoom.map((url, index) => (
                                <CarouselItem key={index}>
                                    <div className="flex aspect-video items-center justify-center p-0 relative">
                                        <Image
                                            src={url}
                                            alt={`${viewingDetailsFor?.name} - Image ${index + 1}`}
                                            fill
                                            style={{ objectFit: "cover" }}
                                            className="bg-muted"
                                        />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                         {allImagesForSelectedRoom.length > 1 && (
                            <>
                                <CarouselPrevious className="left-4 text-white bg-black/50 hover:bg-black/75" />
                                <CarouselNext className="right-4 text-white bg-black/50 hover:bg-black/75" />
                            </>
                        )}
                    </Carousel>
                ) : (
                    <div className="text-center text-muted-foreground aspect-video flex items-center justify-center bg-muted">
                        {t('details_modal.no_images')}
                    </div>
                )}
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-6">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-3xl font-bold font-headline text-[var(--booking-primary)]">{viewingDetailsFor?.name}</DialogTitle>
                </DialogHeader>

                <div>
                    <h4 className="font-semibold text-lg mb-1">{t('details_modal.description_title')}</h4>
                    <p className="text-sm text-muted-foreground">{viewingDetailsFor?.description || t('details_modal.no_description')}</p>
                </div>
                
                 {amenityCategories.map(category => {
                    const amenitiesInCategory = (viewingDetailsFor?.selectedAmenities || [])
                      .map(id => defaultAmenities.find(a => a.id === id))
                      .filter((a): a is Amenity => !!a && a.category === category.key);

                    if (amenitiesInCategory.length === 0) return null;

                    return (
                      <div key={category.key}>
                        <h4 className="font-semibold text-lg mb-2 capitalize">{t(`amenities:categories.${category.labelKey}`)}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                          {amenitiesInCategory.map(amenity => {
                            const Icon = Icons[amenity.icon as keyof typeof Icons] || Check;
                            return (
                              <div key={amenity.id} className="flex items-center text-sm gap-2">
                                <Icon className="h-4 w-4 text-[var(--booking-primary)]" />
                                <span>{t(`amenities:${amenity.labelKey}`)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

