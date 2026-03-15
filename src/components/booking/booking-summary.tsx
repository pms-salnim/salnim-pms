
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Calendar, Users, Tag } from 'lucide-react';
import type { SelectedRoom } from './types';
import type { DateRange } from 'react-day-picker';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import type { Property } from '@/types/property';
import { useTranslation } from 'react-i18next';
import type { Promotion } from '@/types/promotion';
import type { SelectedExtra } from '../calendar/types';
import { Input } from '../ui/input';


interface GuestSelection {
  adults: number;
  children: number;
  rooms: number;
}

interface PriceDetails {
    roomsTotal: number;
    extrasTotal: number;
    subtotal: number;
    discountAmount: number;
    netAmount: number;
    taxAmount: number;
    totalPrice: number;
    priceBeforeDiscount: number;
    appliedPromotion: { id: string; name: string; couponCode?: string | null } | null;
}

interface BookingSummaryProps {
  selections: SelectedRoom[];
  onRemoveRoom?: (selectionId: string) => void;
  dateRange: DateRange | undefined;
  guests: GuestSelection;
  currency: string;
  property: Property | null;
  onContinue: () => void;
  priceDetails: PriceDetails | null;
  allPromotions: Promotion[];
  isProcessing?: boolean;
  isConfirming?: boolean; // Added for confirmation page
  isConfirmationPage?: boolean; // Added to distinguish context
  selectedExtras?: SelectedExtra[];
  onRemoveExtra?: (extraId: string) => void;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
}

export default function BookingSummary({ 
  selections, 
  onRemoveRoom, 
  dateRange, 
  guests, 
  currency, 
  property, 
  onContinue,
  priceDetails,
  allPromotions,
  isProcessing,
  isConfirming,
  isConfirmationPage = false,
  selectedExtras,
  onRemoveExtra,
  onApplyCoupon,
  onRemoveCoupon,
}: BookingSummaryProps) {

  const { t, i18n } = useTranslation('booking_confirmation');
  const locale = i18n.language === 'fr' ? fr : enUS;
  const [couponCode, setCouponCode] = useState('');
  
  const nights = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    const diff = differenceInDays(startOfDay(dateRange.to), startOfDay(dateRange.from));
    return Math.max(0, diff);
  }, [dateRange]);
  

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{t('summary.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dates and Guests Summary */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 font-medium"><Calendar className="h-4 w-4" /> {t('summary.checkin_label')}</div>
                <span className="text-muted-foreground">{dateRange?.from ? format(dateRange.from, 'PP', { locale }) : 'N/A'}</span>
            </div>
             <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 font-medium"><Calendar className="h-4 w-4" /> {t('summary.checkout_label')}</div>
                <span className="text-muted-foreground">{dateRange?.to ? format(dateRange.to, 'PP', { locale }) : 'N/A'}</span>
            </div>
             <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> {t('summary.guests_label')}</div>
                <span className="text-muted-foreground">
                  {t(guests.adults > 1 ? 'summary.adults_text_plural' : 'summary.adults_text_single', { count: guests.adults })}, {t(guests.children > 1 ? 'summary.children_text_plural' : 'summary.children_text_single', { count: guests.children })}
                </span>
            </div>
             <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 font-medium"><Icons.BedDouble className="h-4 w-4" /> {t('summary.stay_label')}</div>
                <span className="text-muted-foreground">{t(nights > 1 ? 'summary.night_text_plural' : 'summary.night_text_single', { count: nights })}</span>
            </div>
        </div>
        
        <Separator />
        
        {/* Selected Rooms */}
        <div className="space-y-3">
          {selections.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">{t('summary.empty_selection')}</p>
          ) : (
            selections.map((sel) => (
              <div key={sel.selectionId} className="space-y-1 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{sel.roomTypeName}</p>
                    <p className="text-xs text-muted-foreground">{sel.ratePlanName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="text-right">
                           <p className="font-semibold">{currency}{sel.priceBeforeDiscount?.toFixed(2)}</p>
                      </div>
                      {onRemoveRoom && !isConfirmationPage && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-full hover:bg-[var(--booking-primary)] hover:text-primary-foreground"
                            onClick={() => onRemoveRoom(sel.selectionId)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Extras */}
        {selectedExtras && selectedExtras.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('summary.extras_title')}</p>
              {selectedExtras.map(extra => (
                  <div key={extra.id} className="space-y-1 text-sm">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="font-semibold">{extra.name} x{extra.quantity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                              <div className="text-right">
                                  <p className="font-semibold">{currency}{extra.total.toFixed(2)}</p>
                              </div>
                              {onRemoveExtra && !isConfirmationPage && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 rounded-full hover:bg-[var(--booking-primary)] hover:text-primary-foreground"
                                    onClick={() => onRemoveExtra(extra.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
            </div>
          </>
        )}
        
        <Separator />

        {/* Coupon Code */}
        {!isConfirmationPage && (
            <div className="space-y-2">
                <div className="flex gap-2">
                    <Input 
                        placeholder={t('summary.promo_code_placeholder')}
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        disabled={!!priceDetails?.appliedPromotion?.couponCode}
                    />
                    <Button 
                        variant="outline" 
                        onClick={() => onApplyCoupon(couponCode)} 
                        disabled={!couponCode || !!priceDetails?.appliedPromotion?.couponCode}
                    >
                        {t('summary.apply_button')}
                    </Button>
                </div>
            </div>
        )}

        {/* Pricing Breakdown */}
        {priceDetails && (selections.length > 0 || (selectedExtras && selectedExtras.length > 0)) && (
            <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('summary.rooms_total')}</span>
                    <span>{currency}{priceDetails.roomsTotal.toFixed(2)}</span>
                </div>
                {priceDetails.extrasTotal > 0 && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('summary.extras_total')}</span>
                        <span>{currency}{priceDetails.extrasTotal.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">{t('summary.subtotal')}</span>
                    <span>{currency}{priceDetails.subtotal.toFixed(2)}</span>
                </div>
                {priceDetails.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                    <span className="font-medium flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        {t('summary.promo_discount')} {priceDetails.appliedPromotion && `(${priceDetails.appliedPromotion.name})`}
                    </span>
                    {priceDetails.appliedPromotion?.couponCode && !isConfirmationPage ? (
                       <Button variant="ghost" size="sm" className="h-auto p-0 text-green-600 hover:text-red-600" onClick={onRemoveCoupon}>
                         <span className="font-medium">-{currency}{priceDetails.discountAmount.toFixed(2)}</span>
                         <X className="h-3 w-3 ml-1"/>
                       </Button>
                    ) : (
                       <span className="font-medium">-{currency}{priceDetails.discountAmount.toFixed(2)}</span>
                    )}
                </div>
                )}
                <div className="flex justify-between font-bold">
                <span>{t('summary.net_amount')}:</span>
                <span>{currency}{(priceDetails.netAmount || 0).toFixed(2)}</span>
                </div>
                {priceDetails.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('summary.taxes_and_fees', { rate: property?.taxSettings?.rate })}:</span>
                    <span>{currency}{priceDetails.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-1.5"/>
                <div className="flex justify-between text-lg font-bold">
                    <span>{t('summary.total')}</span>
                    <span>{currency}{(priceDetails.totalPrice || 0).toFixed(2)}</span>
                </div>
            </div>
        )}
        
      </CardContent>
      {!isConfirmationPage && (
        <CardFooter>
          <Button size="lg" className="w-full h-12 text-lg bg-[var(--booking-primary)] text-white hover:bg-[var(--booking-primary-hover)]" disabled={selections.length === 0 || isProcessing} onClick={onContinue}>
            {isProcessing ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/> : t('summary.continue_button')}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
