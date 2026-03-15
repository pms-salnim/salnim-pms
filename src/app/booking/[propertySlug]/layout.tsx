
"use client";

import React from 'react';
import type { Property } from '@/types/property';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';


const BookingHeader = ({ property, propertySlug }: { property: Property | null, propertySlug: string }) => {
  const { t, i18n } = useTranslation('booking');

  if (!property) return null;

  const logoUrl = property.bookingPageSettings?.logoUrl;
  const logoSize = property.bookingPageSettings?.logoSize || 40; // Default to 40px height
  const buttonText = property.bookingPageSettings?.headerButtonText;
  const buttonLink = property.bookingPageSettings?.headerButtonLink;
  
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <header className="py-4 px-8 border-b bg-background sticky top-0 z-40">
      <div className="w-full max-w-[1500px] mx-auto flex justify-between items-center">
        <Link href={`/booking/${propertySlug}`}>
          {logoUrl ? (
            <div style={{ height: `${logoSize}px`, width: 'auto' }} className="relative aspect-[4/1]">
                <Image src={logoUrl} alt={`${property.name} logo`} fill style={{ objectFit: 'contain' }} priority data-ai-hint="logo company" />
            </div>
          ) : (
            <h1 className="text-xl font-bold">{property.name}</h1>
          )}
        </Link>
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Icons.Globe className="mr-2 h-4 w-4" />
                        {i18n.language.toUpperCase()}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleLanguageChange('en')}>English</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLanguageChange('fr')}>Français</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {buttonText && buttonLink && (
              <Button asChild className="bg-[var(--booking-primary)] hover:bg-[var(--booking-primary-hover)]">
                <Link href={buttonLink}>{buttonText}</Link>
              </Button>
            )}
        </div>
      </div>
    </header>
  );
};


function PublicBookingLayoutClient({
  children,
  propertySlug,
}: {
  children: React.ReactNode;
  propertySlug: string;
}) {
  const [property, setProperty] = React.useState<Property | null>(null);

  React.useEffect(() => {
    async function getPropertySettings(slug: string): Promise<Property | null> {
        if (!slug) return null;
        try {
            const propQuery = query(
                collection(db, "properties"),
                where("slug", "==", slug),
                limit(1)
            );
            const propSnapshot = await getDocs(propQuery);
            if (!propSnapshot.empty) {
                const propDoc = propSnapshot.docs[0];
                return { id: propDoc.id, ...propDoc.data() } as Property;
            }
        } catch (error) {
            console.error("Failed to fetch property settings:", error);
        }
        return null;
    }
    getPropertySettings(propertySlug).then(setProperty);
  }, [propertySlug]);

  const primaryColor = property?.bookingPageSettings?.primaryColor || '#003166';
  const primaryColorHover = property?.bookingPageSettings?.primaryColorHover || '#002a55';
  
  let primaryColorRange = primaryColorHover;
  if (primaryColorHover.length === 7) { 
      primaryColorRange = `${primaryColorHover}80`;
  } else if (primaryColorHover.length === 9) { 
      primaryColorRange = primaryColorHover;
  }

  return (
    <>
        <style>{`
        :root {
            --booking-primary: ${primaryColor};
            --booking-primary-hover: ${primaryColorHover};
            --booking-primary-range: ${primaryColorRange};
        }
        `}</style>
        <div className="bg-background min-h-screen font-body">
            <BookingHeader property={property} propertySlug={propertySlug} />
            {children}
        </div>
    </>
  );
}

export default function PublicBookingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { propertySlug: string };
}) {
  const resolvedParams = React.use(params);
  return (
    <PublicBookingLayoutClient propertySlug={resolvedParams.propertySlug}>
      {children}
    </PublicBookingLayoutClient>
  );
}
