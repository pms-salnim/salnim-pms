
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from 'next/image';
import type { Property } from '@/types/property';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

interface PropertyInfoCardProps {
  property: Property;
}

export default function PropertyInfoCard({ property }: PropertyInfoCardProps) {
  const { t } = useTranslation('booking');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '' });

  const handleOpenModal = (title: string, content: string) => {
    setModalContent({ title, content });
    setIsModalOpen(true);
  };
  
  const formattedWebsite = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
  }

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          {property.bookingPageSettings?.logoUrl && (
              <Image 
                  src={property.bookingPageSettings.logoUrl} 
                  alt={`${property.name} logo`}
                  width={64}
                  height={64}
                  className="rounded-md object-contain h-16 w-16"
                  data-ai-hint="building logo"
              />
          )}
          <div className="flex-1">
            <CardTitle className="text-xl">{t('property_info_card.welcome', { propertyName: property.name })}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {property.website && (
              <p className="text-sm text-muted-foreground">
                  {t('property_info_card.visit_website')} <a href={formattedWebsite(property.website)} target="_blank" rel="noopener noreferrer" className="text-[var(--booking-primary)] hover:underline">{property.website}</a>
              </p>
          )}
          
          <Separator />
          
          <div className="space-y-2 text-sm">
              <p className="font-semibold">{t('property_info_card.contact_info')}</p>
              {property.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{property.address}</span>
                  </div>
              )}
              {property.phone && (
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{property.phone}</span>
                  </div>
              )}
              {property.email && (
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{property.email}</span>
                  </div>
              )}
          </div>
          <Separator />
          <div className="flex items-center justify-start gap-4 text-sm font-medium">
            {property.cancellationPolicy && (
                <Button variant="link" className="p-0 h-auto text-[var(--booking-primary)]" onClick={() => handleOpenModal('Cancellation Policy', property.cancellationPolicy || 'No policy defined.')}>
                    Cancellation Policy
                </Button>
            )}
             {property.aboutUs && (
                <Button variant="link" className="p-0 h-auto text-[var(--booking-primary)]" onClick={() => handleOpenModal('About The Property', property.aboutUs || 'No information available.')}>
                    About The Property
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{modalContent.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-1">
              {modalContent.content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
