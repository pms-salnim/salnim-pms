"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building } from 'lucide-react';
import Link from 'next/link';

// This page serves as a placeholder for the root /booking directory.
// It informs users that they need a direct link to a specific property's booking page.
export default function BookingRootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
             <Building className="h-6 w-6" data-ai-hint="building"/>
          </div>
          <CardTitle className="mt-4">Looking for a Property?</CardTitle>
          <CardDescription>
            This is the central booking portal. Please use the direct link provided by the property to make a reservation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A property-specific link looks like: <br/>
            <code className="mt-1 inline-block bg-muted px-2 py-1 text-xs rounded-sm">/booking/your_property_id</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
