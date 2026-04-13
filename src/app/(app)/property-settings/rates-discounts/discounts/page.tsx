
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import PromotionList from "@/components/rate-plans/promotion-list";
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
import type { Promotion } from '@/types/promotion';
import type { RatePlan } from '@/types/ratePlan';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

const PromotionForm = dynamic(() => import('@/components/rate-plans/promotion-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const ratesDiscountsSubtabs = [
  { id: 'rates', label: 'Rate Plans', href: '/property-settings/rates-discounts/rates' },
  { id: 'seasonal', label: 'Seasonal Pricing', href: '/property-settings/rates-discounts/seasonal' },
  { id: 'discounts', label: 'Discounts', href: '/property-settings/rates-discounts/discounts' },
  { id: 'availability', label: 'Availability', href: '/property-settings/rates-discounts/availability' },
];

export default function PromotionsPage() {
  const { user, isLoadingAuth, property } = useAuth();
  const { t } = useTranslation('pages/rate-plans/promotions/content');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);

  const canManage = user?.permissions?.ratePlans;

  // Fetch promotions and rate plans when property loads
  useEffect(() => {
    if (!property?.id || !user?.id) {
      setPromotions([]);
      setRatePlans([]);
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

        // Fetch promotions
        const promotionsResponse = await fetch(`/api/promotions/list?propertyId=${property.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (promotionsResponse.ok) {
          const promotionsData = await promotionsResponse.json();
          setPromotions(promotionsData.promotions || []);
        } else {
          console.error('Failed to fetch promotions:', promotionsResponse.status);
          toast({ 
            title: 'Error', 
            description: 'Could not fetch promotions.', 
            variant: 'destructive' 
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ 
          title: 'Error', 
          description: 'Could not fetch promotions or rate plans.', 
          variant: 'destructive' 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [property?.id, user?.id]);

  const handleOpenModal = (promo: Promotion | null = null) => {
    if (!canManage) return;
    setEditingPromotion(promo);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromotion(null);
  };

  const handleSavePromotion = async (formData: Omit<Promotion, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>) => {
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

      // Generate a UUID for new promotions
      const promotionId = editingPromotion?.id || crypto.randomUUID();

      console.log('Sending promotion to API:', { propertyId: property.id, userId: user.id, action: editingPromotion ? 'update' : 'create' });

      const response = await fetch('/api/promotions/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: editingPromotion ? 'update' : 'create',
          propertyId: property.id,
          promotionId: editingPromotion?.id,
          promotion: {
            id: promotionId,
            ...formData,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save promotion');
      }

      const result = await response.json();
      
      if (editingPromotion) {
        toast({ 
          title: t('toasts.success_update_title'), 
          description: t('toasts.success_update_description') 
        });
      } else {
        toast({ 
          title: t('toasts.success_create_title'), 
          description: t('toasts.success_create_description') 
        });
      }

      // Refresh promotions list
      const promotionsResponse = await fetch(`/api/promotions/list?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (promotionsResponse.ok) {
        const promotionsData = await promotionsResponse.json();
        setPromotions(promotionsData.promotions || []);
      }

      handleCloseModal();
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast({ 
        title: t('toasts.error_save_title'), 
        description: (error as Error).message || t('toasts.error_save_description'), 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePromotion = (promotion: Promotion) => {
    if (!canManage) return;
    setPromotionToDelete(promotion);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeletePromotion = async () => {
    if (!promotionToDelete || !property?.id || !user?.id) return;
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/promotions/crud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          propertyId: property.id,
          promotionId: promotionToDelete.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete promotion');
      }

      toast({ 
        title: t('toasts.success_delete_title'), 
        description: t('toasts.success_delete_description') 
      });

      // Refresh promotions list
      const promotionsResponse = await fetch(`/api/promotions/list?propertyId=${property.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (promotionsResponse.ok) {
        const promotionsData = await promotionsResponse.json();
        setPromotions(promotionsData.promotions || []);
      }
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast({ 
        title: t('toasts.error_delete_title'), 
        description: (error as Error).message || t('toasts.error_delete_description'), 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
      setPromotionToDelete(null);
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
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to manage promotions.
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
            <Button onClick={() => handleOpenModal()} disabled={!canManage}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
              <DialogHeader>
                <DialogTitle>{editingPromotion ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
                <DialogDescription>
                  {t(editingPromotion ? 'edit_modal.description' : 'add_modal.description')}
                </DialogDescription>
              </DialogHeader>
              <PromotionForm
                initialData={editingPromotion}
                ratePlans={ratePlans}
                onSave={handleSavePromotion}
                onClose={handleCloseModal}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      <PromotionList
        promotions={promotions}
        onEdit={handleOpenModal}
        onDelete={handleDeletePromotion}
        isLoading={isLoading}
        canManage={canManage}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { name: promotionToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPromotionToDelete(null)}>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePromotion} disabled={isLoading}>
                {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                {t('buttons.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
