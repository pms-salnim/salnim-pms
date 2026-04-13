
"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import RatePlanFilters from "@/components/rate-plans/rate-plan-filters";
import RatePlanList from "@/components/rate-plans/rate-plan-list";
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
} from "@/components/ui/alert-dialog";
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import type { RatePlan } from '@/types/ratePlan';
import type { RoomType } from '@/types/roomType';
import { Icons } from '@/components/icons';
import type { Property } from '@/types/property';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const RatePlanForm = dynamic(() => import('@/components/rate-plans/rate-plan-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const ratesDiscountsSubtabs = [
  { id: 'rates', label: 'Rate Plans', href: '/property-settings/rates-discounts/rates' },
  { id: 'seasonal', label: 'Seasonal Pricing', href: '/property-settings/rates-discounts/seasonal' },
  { id: 'discounts', label: 'Discounts', href: '/property-settings/rates-discounts/discounts' },
  { id: 'availability', label: 'Availability', href: '/property-settings/rates-discounts/availability' },
];

export default function AllRatePlansPage() {
  const { user, isLoadingAuth, property } = useAuth();
  const { t } = useTranslation('pages/rate-plans/all/content');
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRatePlan, setEditingRatePlan] = useState<RatePlan | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [ratePlanToDelete, setRatePlanToDelete] = useState<RatePlan | null>(null);

  const [filters, setFilters] = useState({
    searchTerm: '',
    roomTypeId: 'all',
    status: 'all',
  });
  
  const canManage = user?.permissions?.ratePlans;

  // Fetch rate plans and room types when property loads
  useEffect(() => {
    if (!property?.id || !user?.id) {
      setRatePlans([]);
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

        // Set property settings
        setPropertySettings(property as Property);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ title: 'Error', description: 'Could not fetch rate plans or room types.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [property?.id, user?.id]);

  const filteredRatePlans = useMemo(() => {
    return ratePlans.filter(plan => {
      if (filters.searchTerm && !plan.planName.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
        return false;
      }
      if (filters.roomTypeId !== 'all' && plan.roomTypeId !== filters.roomTypeId) {
        return false;
      }
      // Assuming all plans are 'active' for now, as there's no status field in the data model.
      // This can be expanded if a status field is added to Rate Plans.
      if (filters.status === 'inactive') {
        return false;
      }
      return true;
    });
  }, [ratePlans, filters]);

  const handleOpenModal = (ratePlan: RatePlan | null = null) => {
    if (!canManage) return;
    setEditingRatePlan(ratePlan);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRatePlan(null);
  };

  const handleSaveRatePlan = async (formData: Omit<RatePlan, 'id' | 'propertyId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
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

      // Generate a UUID for new rate plans
      const planId = editingRatePlan?.id || crypto.randomUUID();

      console.log('Sending rate plan to API:', { propertyId: property.id, userId: user.id, action: editingRatePlan ? 'update' : 'create' });

      const response = await fetch('/api/rate-plans/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: editingRatePlan ? 'update' : 'create',
          propertyId: property.id,
          ratePlanId: editingRatePlan?.id,
          ratePlan: {
            id: planId,
            ...formData,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save rate plan');
      }

      toast({
        title: editingRatePlan ? t('toasts.success_update_title') : t('toasts.success_create_title'),
        description: editingRatePlan ? t('toasts.success_update_description') : t('toasts.success_create_description'),
      });

      handleCloseModal();

      // Reload rate plans
      const listResponse = await fetch(`/api/rate-plans/list?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setRatePlans(data.ratePlans || []);
      }
    } catch (error) {
      console.error("Error saving rate plan:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save rate plan';
      toast({
        title: t('toasts.error_save_title'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRatePlan = (ratePlan: RatePlan) => {
    if (!canManage) return;
    setRatePlanToDelete(ratePlan);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRatePlan = async () => {
    if (!ratePlanToDelete || !property?.id) return;
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/rate-plans/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          propertyId: property.id,
          ratePlanId: ratePlanToDelete.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete rate plan');
      }

      toast({ title: t('toasts.success_delete_title'), description: t('toasts.success_delete_description') });

      // Reload rate plans
      const listResponse = await fetch(`/api/rate-plans/list?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setRatePlans(data.ratePlans || []);
      }
    } catch (error) {
      console.error("Error deleting rate plan:", error);
      toast({ title: t('toasts.error_delete_title'), description: t('toasts.error_delete_description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setRatePlanToDelete(null);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenModal()} disabled={!property?.id || roomTypes.length === 0 || !canManage}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
              <DialogHeader>
                <DialogTitle>{editingRatePlan ? t('edit_modal_title') : t('add_modal_title')}</DialogTitle>
                <DialogDescription>
                  {t('modal_description')}
                  {roomTypes.length === 0 && <p className="text-destructive text-sm mt-2">{t('no_room_types_warning')}</p>}
                </DialogDescription>
              </DialogHeader>
              {property?.id && roomTypes.length > 0 && (
                <RatePlanForm
                  initialData={editingRatePlan}
                  availableRoomTypes={roomTypes}
                  onSave={handleSaveRatePlan}
                  onClose={handleCloseModal}
                  propertyId={property.id}
                />
              )}
            </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      <RatePlanFilters 
        roomTypes={roomTypes}
        onFilterChange={setFilters}
      />
      <RatePlanList
        ratePlans={filteredRatePlans}
        roomTypes={roomTypes}
        onEditRatePlan={handleOpenModal}
        onDeleteRatePlan={handleDeleteRatePlan}
        isLoading={isLoading && ratePlans.length === 0}
        propertySettings={propertySettings}
        canManage={canManage}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { planName: ratePlanToDelete?.planName || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRatePlanToDelete(null)}>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRatePlan} disabled={isLoading}>
                {isLoading ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" /> : t('delete_dialog.continue_button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
