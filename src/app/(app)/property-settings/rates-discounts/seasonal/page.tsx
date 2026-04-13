
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import SeasonalRateList from "@/components/rate-plans/seasonal-rate-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import type { SeasonalRate } from '@/types/seasonalRate';
import type { RatePlan } from '@/types/ratePlan';
import type { RoomType } from '@/types/roomType';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const SeasonalRateForm = dynamic(() => import('@/components/rate-plans/seasonal-rate-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const ratesDiscountsSubtabs = [
  { id: 'rates', label: 'Rate Plans', href: '/property-settings/rates-discounts/rates' },
  { id: 'seasonal', label: 'Seasonal Pricing', href: '/property-settings/rates-discounts/seasonal' },
  { id: 'discounts', label: 'Discounts', href: '/property-settings/rates-discounts/discounts' },
  { id: 'availability', label: 'Availability', href: '/property-settings/rates-discounts/availability' },
];

export default function SeasonalPricingPage() {
  const { user, isLoadingAuth, property } = useAuth();
  const { t } = useTranslation('pages/rate-plans/seasonal/content');
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<SeasonalRate | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<SeasonalRate | null>(null);

  const canManage = user?.permissions?.ratePlans;

  // Fetch seasonal rates, rate plans, and room types when property loads
  useEffect(() => {
    if (!property?.id || !user?.id) {
      setSeasonalRates([]);
      setRatePlans([]);
      setRoomTypes([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
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

        // Fetch rate plans
        const ratePlansResponse = await fetch(`/api/rate-plans/list?propertyId=${property.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (ratePlansResponse.ok) {
          const ratePlansData = await ratePlansResponse.json();
          setRatePlans(ratePlansData.ratePlans || []);
        }

        // Fetch seasonal rates
        const seasonalRatesResponse = await fetch(`/api/seasonal-rates/list?propertyId=${property.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (seasonalRatesResponse.ok) {
          const seasonalRatesData = await seasonalRatesResponse.json();
          setSeasonalRates(seasonalRatesData.seasonalRates || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ title: 'Error', description: 'Could not fetch seasonal rates or rate plans.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [property?.id, user?.id]);

  const handleOpenModal = (rate: SeasonalRate | null = null) => {
    if (!canManage) return;
    setEditingRate(rate);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRate(null);
  };

  const handleSaveRate = async (formData: Omit<SeasonalRate, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!property?.id || !user?.id || !canManage) {
      toast({ title: "Error", description: "Permission denied or property/user not identified.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      // Generate a UUID for new seasonal rates
      const rateId = editingRate?.id || crypto.randomUUID();

      const response = await fetch('/api/seasonal-rates/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: editingRate ? 'update' : 'create',
          propertyId: property.id,
          seasonalRateId: editingRate?.id,
          seasonalRate: {
            id: rateId,
            ...formData,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save seasonal rate');
      }

      toast({
        title: editingRate ? t('toasts.success_update_title') : t('toasts.success_create_title'),
        description: editingRate ? t('toasts.success_update_description') : t('toasts.success_create_description'),
      });

      handleCloseModal();

      // Reload seasonal rates
      const listResponse = await fetch(`/api/seasonal-rates/list?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setSeasonalRates(data.seasonalRates || []);
      }
    } catch (error) {
      console.error("Error saving seasonal rate:", error);
      toast({
        title: t('toasts.error_save_title'),
        description: t('toasts.error_save_description'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRate = (rate: SeasonalRate) => {
    if (!canManage) return;
    setRateToDelete(rate);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRate = async () => {
    if (!rateToDelete || !property?.id) return;
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/seasonal-rates/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          propertyId: property.id,
          seasonalRateId: rateToDelete.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete seasonal rate');
      }

      toast({ title: t('toasts.success_delete_title'), description: t('toasts.success_delete_description') });

      // Reload seasonal rates
      const listResponse = await fetch(`/api/seasonal-rates/list?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setSeasonalRates(data.seasonalRates || []);
      }
    } catch (error) {
      console.error("Error deleting seasonal rate:", error);
      toast({ title: t('toasts.error_delete_title'), description: t('toasts.error_delete_description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setRateToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.ratePlans) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
        </div>
        <PropertySettingsSubtabs subtabs={ratesDiscountsSubtabs} />
      </div>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenModal()} disabled={!canManage || ratePlans.length === 0}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
              <DialogHeader>
                <DialogTitle>{editingRate ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
                <DialogDescription>
                  {t('add_modal.description')}
                  {ratePlans.length === 0 && <p className="text-destructive text-sm mt-2">{t('add_modal.no_rate_plans_warning')}</p>}
                </DialogDescription>
              </DialogHeader>
              <SeasonalRateForm
                initialData={editingRate}
                ratePlans={ratePlans}
                roomTypes={roomTypes}
                seasonalRates={seasonalRates}
                onSave={handleSaveRate}
                onClose={handleCloseModal}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      <SeasonalRateList
        seasonalRates={seasonalRates}
        ratePlans={ratePlans}
        roomTypes={roomTypes}
        onEdit={handleOpenModal}
        onDelete={handleDeleteRate}
        isLoading={isLoading}
        canManage={canManage}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { name: rateToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRateToDelete(null)}>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRate} disabled={isLoading}>
                {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                {t('buttons.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
