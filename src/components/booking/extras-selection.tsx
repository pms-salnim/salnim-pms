
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import Image from 'next/image';
import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from "../ui/card";
import type { Service, ServiceUnit } from '@/types/service';
import type { MealPlan, MealPlanUnit } from '@/types/mealPlan';
import type { SelectedExtra } from '@/components/calendar/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Icons } from '../icons';

interface ExtrasSelectionProps {
    services: Service[];
    mealPlans: MealPlan[];
    selectedExtras: SelectedExtra[];
    onExtrasChange: (extras: SelectedExtra[]) => void;
    nights: number;
    guests: number;
    currency: string;
}

type ExtraItem = (Service | MealPlan) & { type: 'service' | 'meal_plan', imageUrl?: string | null };

export default function ExtrasSelection({ services, mealPlans, selectedExtras, onExtrasChange, nights, guests, currency }: ExtrasSelectionProps) {
    const { t } = useTranslation('booking_extras');
    const [viewingDetailsFor, setViewingDetailsFor] = useState<ExtraItem | null>(null);

    const handleQuantityChange = (item: ExtraItem, delta: number) => {
        const existingExtra = selectedExtras.find(e => e.id === item.id);
        const currentQuantity = existingExtra ? existingExtra.quantity : 0;
        const newQuantity = currentQuantity + delta;

        if (newQuantity <= 0) {
            onExtrasChange(selectedExtras.filter(e => e.id !== item.id));
        } else {
            const newExtra: SelectedExtra = {
                id: item.id,
                name: item.name,
                price: item.price, // Storing the UNIT price
                quantity: newQuantity,
                unit: item.unit,
                type: item.type,
            };
            if (existingExtra) {
                onExtrasChange(selectedExtras.map(e => e.id === item.id ? newExtra : e));
            } else {
                onExtrasChange([...selectedExtras, newExtra]);
            }
        }
    };
    
    const getUnitLabel = (unit: ServiceUnit | MealPlanUnit) => {
        return t(`units.${unit.replace(/_/g, '-')}`);
    };

    const combinedExtras = [
        ...services.map(s => ({ ...s, type: 'service' as const })),
        ...mealPlans.map(m => ({ ...m, type: 'meal_plan' as const }))
    ];

    if (combinedExtras.length === 0) {
        return null;
    }

    return (
        <>
            <div className="space-y-6">
                <h3 className="text-2xl font-bold font-headline">{t('title')}</h3>
                {combinedExtras.map((item) => {
                    const selected = selectedExtras.find(e => e.id === item.id);
                    const quantity = selected ? selected.quantity : 0;
                    const unitPrice = item.price;
                    return (
                        <Card key={item.id} className="overflow-hidden shadow-md w-full">
                            <div className="flex flex-col md:flex-row">
                                <div className="relative flex-shrink-0 w-full md:w-64 aspect-video md:aspect-[4/3] bg-muted cursor-pointer group" onClick={() => setViewingDetailsFor(item)}>
                                    <Image src={item.imageUrl || `https://placehold.co/400x300.png`} alt={item.name} fill style={{ objectFit: "cover" }} data-ai-hint="food service" className="group-hover:opacity-80 transition-opacity" />
                                     <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Eye className="h-8 w-8 text-white" /></div>
                                </div>
                                
                                <div className="p-4 sm:p-6 flex flex-col md:flex-row flex-grow w-full justify-between items-start">
                                    <div className="flex flex-col flex-grow h-full">
                                        <CardTitle className="text-xl font-medium font-headline">{item.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description || 'No description available.'}</p>
                                        <div className="flex-grow" />
                                        <button onClick={() => setViewingDetailsFor(item)} className="text-sm text-[var(--booking-primary)] hover:underline mt-1 text-left w-fit font-semibold">
                                            {t('more_details_link')}
                                        </button>
                                    </div>

                                    <div className="w-full md:w-auto flex flex-col items-start md:items-end md:pl-4 gap-4 h-full mt-4 md:mt-0">
                                        <div className="text-left md:text-right flex-grow">
                                            <p className="text-2xl font-bold text-foreground">{currency}{unitPrice.toFixed(2)}</p>
                                            <p className="text-xs text-muted-foreground">{getUnitLabel(item.unit)}</p>
                                        </div>
                                         <div className="w-full md:w-auto">
                                            {quantity > 0 ? (
                                                <div className="flex items-center gap-2 w-full justify-end">
                                                    <Button variant="outline" size="icon" className="h-9 w-9 transition-colors" onClick={() => handleQuantityChange(item, -1)}><Minus className="h-4 w-4" /></Button>
                                                    <span className="w-10 text-center font-bold text-lg">{quantity}</span>
                                                    <Button variant="outline" size="icon" className="h-9 w-9 transition-colors" onClick={() => handleQuantityChange(item, 1)}><Plus className="h-4 w-4" /></Button>
                                                </div>
                                            ) : (
                                                <Button variant="outline" className="w-full md:w-auto border-[var(--booking-primary)] text-[var(--booking-primary)] hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground" onClick={() => handleQuantityChange(item, 1)}>{t('add_to_booking')}</Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={!!viewingDetailsFor} onOpenChange={(isOpen) => !isOpen && setViewingDetailsFor(null)}>
                <DialogContent className="sm:max-w-xl p-0">
                    <div className="w-full">
                        {viewingDetailsFor?.imageUrl ? (
                             <div className="flex aspect-video items-center justify-center p-0 relative rounded-t-lg overflow-hidden">
                                <Image
                                    src={viewingDetailsFor.imageUrl}
                                    alt={viewingDetailsFor.name}
                                    fill
                                    style={{ objectFit: "cover" }}
                                    className="bg-muted"
                                />
                            </div>
                        ) : null}
                    </div>
                    <div className="p-6 space-y-4">
                        <DialogHeader className="text-left">
                            <DialogTitle className="text-2xl font-bold font-headline">{viewingDetailsFor?.name}</DialogTitle>
                        </DialogHeader>
                         <div>
                            <p className="text-sm text-muted-foreground">{viewingDetailsFor?.description || 'No description available.'}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
