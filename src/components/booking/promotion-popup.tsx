
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { X, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Promotion } from '@/types/promotion';
import { cn } from '@/lib/utils';

interface PromoCardSettings {
    enabled?: boolean;
    displayType?: 'auto' | 'manual';
    title?: string;
    description?: string;
    imageUrl?: string;
    promotionId?: string;
    manualDesignImageUrl?: string;
}

interface PromotionPopupProps {
    settings?: PromoCardSettings;
    promotions: Promotion[];
}

export default function PromotionPopup({ settings, promotions }: PromotionPopupProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [hasBeenShown, setHasBeenShown] = useState(false);

    useEffect(() => {
        if (settings?.enabled && !hasBeenShown) {
            const timer = setTimeout(() => {
                setIsOpen(true);
                setHasBeenShown(true); // Ensure it only shows once per session
            }, 3000); // 3-second delay
            return () => clearTimeout(timer);
        }
    }, [settings, hasBeenShown]);

    if (!settings?.enabled) {
        return null;
    }

    const promotion = promotions.find(p => p.id === settings.promotionId);

    const handleCopyCode = () => {
        if (promotion?.couponCode) {
            navigator.clipboard.writeText(promotion.couponCode);
            toast({
                title: "Code Copied!",
                description: `Coupon code "${promotion.couponCode}" has been copied to your clipboard.`,
            });
        }
    };
    
    if (settings.displayType === 'manual' && settings.manualDesignImageUrl) {
        return (
             <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="p-0 max-w-2xl border-0 bg-transparent shadow-none data-[state=open]:animate-in data-[state=open]:fade-in-0">
                     <DialogHeader>
                        <DialogTitle className="sr-only">{settings.title || "Promotion"}</DialogTitle>
                     </DialogHeader>
                     <div className="relative aspect-video w-full">
                        <Image src={settings.manualDesignImageUrl} alt={settings.title || "Promotion"} fill style={{objectFit: 'contain'}} />
                     </div>
                </DialogContent>
            </Dialog>
        )
    }

    if (settings.displayType === 'auto' && settings.title) {
      return (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                  <div className="relative aspect-video w-full">
                      {settings.imageUrl && (
                          <Image src={settings.imageUrl} alt={settings.title || "Promotion"} fill style={{objectFit: 'cover'}} data-ai-hint="bedroom suite" />
                      )}
                  </div>
                  <div className="px-6 pb-6 text-center space-y-4">
                       <DialogHeader className="pt-4">
                          <DialogTitle className="text-2xl font-bold">{settings.title}</DialogTitle>
                      </DialogHeader>
                      <p className="text-muted-foreground">{settings.description}</p>
                      {promotion?.couponCode && (
                          <div className="p-4 border-dashed border-2 border-primary rounded-lg flex flex-col items-center gap-2">
                              <span className="text-2xl font-bold tracking-widest">{promotion.couponCode}</span>
                              <Button onClick={handleCopyCode} className="w-full">
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Code
                              </Button>
                          </div>
                      )}
                  </div>
              </DialogContent>
          </Dialog>
      );
    }
    
    return null; // Return null if conditions are not met
}
