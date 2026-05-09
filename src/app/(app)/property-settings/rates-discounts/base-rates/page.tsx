"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import type { RoomType } from '@/types/roomType';
import type { Property } from '@/types/property';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';

export interface BaseRate {
  id: string;
  property_id: string;
  room_type_id: string;
  name: string;
  base_price: number;
  start_date: string;
  end_date: string | null;
  extra_adult_price?: number;
  extra_adult_price_type?: 'fixed' | 'percentage';
  extra_child_price?: number;
  extra_child_price_type?: 'fixed' | 'percentage';
  single_use_discount?: number | null;
  single_use_discount_type?: 'fixed' | 'percentage';
  min_los?: number | null;
  max_los?: number | null;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const BaseRateForm = dynamic(() => import('@/components/base-rates/base-rate-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const BaseRateList = dynamic(() => import('@/components/base-rates/base-rate-list'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const ratesDiscountsSubtabs = [
  { id: 'rates', label: 'Rate Plans', href: '/property-settings/rates-discounts/rates' },
  { id: 'base-rates', label: 'Base Rates', href: '/property-settings/rates-discounts/base-rates' },
  { id: 'seasonal', label: 'Seasonal Pricing', href: '/property-settings/rates-discounts/seasonal' },
  { id: 'discounts', label: 'Discounts', href: '/property-settings/rates-discounts/discounts' },
  { id: 'availability', label: 'Availability', href: '/property-settings/rates-discounts/availability' },
];

export default function BaseRatesPage() {
  const { user, isLoadingAuth, property } = useAuth();
  const { t } = useTranslation('pages/rate-plans/all/content');
  const [baseRates, setBaseRates] = useState<BaseRate[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBaseRate, setEditingBaseRate] = useState<BaseRate | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [baseRateToDelete, setBaseRateToDelete] = useState<BaseRate | null>(null);

  const canManage = user?.permissions?.ratePlans;

  // Fetch base rates and room types when property loads
  useEffect(() => {
    if (!property?.id || !user?.id) {
      setBaseRates([]);
      setRoomTypes([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get session for authentication
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('No active session');
        }

        // Fetch room types
        const roomTypesResponse = await fetch(`/api/rooms/room-types/list?propertyId=${property.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (roomTypesResponse.ok) {
          const roomTypesData = await roomTypesResponse.json();
          setRoomTypes(roomTypesData.roomTypes || []);
        }

        // Fetch base rates
        const baseRatesResponse = await fetch(`/api/pricing/base-rates?propertyId=${property.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (baseRatesResponse.ok) {
          const baseRatesData = await baseRatesResponse.json();
          setBaseRates(baseRatesData.baseRates || []);
        }

        // Set property settings
        setPropertySettings(property as Property);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ title: 'Error', description: 'Could not fetch base rates or room types.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [property?.id, user?.id]);

  const handleOpenModal = (baseRate: BaseRate | null = null) => {
    if (!canManage) return;
    setEditingBaseRate(baseRate);
    setIsModalOpen(!isModalOpen);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBaseRate(null);
  };

  const handleSaveBaseRate = async (formData: any) => {
    if (!property?.id || !user?.id || !canManage) {
      console.error('Validation failed:', { propertyId: property?.id, userId: user?.id, canManage });
      toast({ title: "Error", description: "Permission denied or property/user not identified.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const baseRateId = editingBaseRate?.id || crypto.randomUUID();

      const response = await fetch('/api/pricing/base-rates', {
        method: editingBaseRate ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          propertyId: property.id,
          baseRateId: editingBaseRate?.id,
          baseRate: {
            id: baseRateId,
            property_id: property.id,
            ...formData,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save base rate');
      }

      toast({
        title: editingBaseRate ? 'Success' : 'Success',
        description: editingBaseRate ? 'Base rate updated successfully' : 'Base rate created successfully',
      });

      handleCloseModal();

      // Reload base rates
      const listResponse = await fetch(`/api/pricing/base-rates?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setBaseRates(data.baseRates || []);
      }
    } catch (error) {
      console.error("Error saving base rate:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save base rate';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBaseRate = (baseRate: BaseRate) => {
    if (!canManage) return;
    setBaseRateToDelete(baseRate);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteBaseRate = async () => {
    if (!baseRateToDelete || !property?.id) return;
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/pricing/base-rates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          propertyId: property.id,
          baseRateId: baseRateToDelete.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete base rate');
      }

      toast({ title: 'Success', description: 'Base rate deleted successfully' });

      // Reload base rates
      const listResponse = await fetch(`/api/pricing/base-rates?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setBaseRates(data.baseRates || []);
      }
    } catch (error) {
      console.error("Error deleting base rate:", error);
      toast({ title: 'Error', description: 'Failed to delete base rate', variant: "destructive" });
    } finally {
      setIsLoading(false);
      setBaseRateToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };
  
  if (isLoadingAuth || (isLoading && !property?.id)) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user?.permissions?.ratePlans) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to manage base rates.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            Base Rates
          </h1>
        </div>
        <PropertySettingsSubtabs subtabs={ratesDiscountsSubtabs} />
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-muted-foreground">
            Set base rates for your room types. Rate plans can derive pricing from these base rates with adjustments.
          </p>
        </div>
        <Button 
          onClick={() => handleOpenModal()} 
          disabled={!property?.id || roomTypes.length === 0 || !canManage}
          variant={isModalOpen ? "default" : "outline"}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> 
          {isModalOpen ? 'Cancel' : 'Add Base Rate'}
        </Button>
      </div>

      {/* Expandable Form Section */}
      {isModalOpen && (
        <div className="w-full bg-card border border-border rounded-lg p-6 animate-in fade-in-50">
          {roomTypes.length === 0 && (
            <Alert variant="destructive" className="mt-3">
              <Icons.AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No room types available. Please create room types first.
              </AlertDescription>
            </Alert>
          )}
          
          {property?.id && roomTypes.length > 0 && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
              <BaseRateForm
                initialData={editingBaseRate}
                availableRoomTypes={roomTypes}
                onSave={handleSaveBaseRate}
                onClose={handleCloseModal}
                propertyId={property.id}
              />
            </Suspense>
          )}
        </div>
      )}

      <BaseRateList
        baseRates={baseRates}
        roomTypes={roomTypes}
        onEditBaseRate={handleOpenModal}
        onDeleteBaseRate={handleDeleteBaseRate}
        isLoading={isLoading && baseRates.length === 0}
        propertySettings={propertySettings}
        canManage={canManage}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Base Rate?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this base rate? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBaseRateToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBaseRate} disabled={isLoading}>
                {isLoading ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
