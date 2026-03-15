
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
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { Promotion } from '@/types/promotion';
import type { RatePlan } from '@/types/ratePlan';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

const PromotionForm = dynamic(() => import('@/components/rate-plans/promotion-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


export default function PromotionsPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/rate-plans/promotions/content');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);

  const canManage = user?.permissions?.ratePlans;
  const propertyId = user?.propertyId;

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const promoQuery = query(collection(db, "promotions"), where("propertyId", "==", propertyId));
    const rpQuery = query(collection(db, "ratePlans"), where("propertyId", "==", propertyId));

    const unsubPromo = onSnapshot(promoQuery, (snapshot) => {
      setPromotions(snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        startDate: (docSnap.data().startDate as Timestamp),
        endDate: (docSnap.data().endDate as Timestamp),
      } as Promotion)));
    });

    const unsubRP = onSnapshot(rpQuery, (snapshot) => {
      setRatePlans(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RatePlan)));
      setIsLoading(false);
    });

    return () => {
      unsubPromo();
      unsubRP();
    };
  }, [propertyId]);

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
    if (!propertyId || !user?.id || !canManage) {
      toast({ title: "Error", description: t('toasts.permission_denied'), variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const dataToSave = {
      ...formData,
      propertyId,
    };

    try {
      if (editingPromotion) {
        const docRef = doc(db, "promotions", editingPromotion.id);
        await updateDoc(docRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.success_update_title'), description: t('toasts.success_update_description') });
      } else {
        await addDoc(collection(db, "promotions"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: t('toasts.success_create_title'), description: t('toasts.success_create_description') });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast({ title: t('toasts.error_save_title'), description: t('toasts.error_save_description'), variant: "destructive" });
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
    if (!promotionToDelete) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "promotions", promotionToDelete.id));
      toast({ title: t('toasts.success_delete_title'), description: t('toasts.success_delete_description') });
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast({ title: t('toasts.error_delete_title'), description: t('toasts.error_delete_description'), variant: "destructive" });
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
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
                <DialogTitle>{editingPromotion ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
                <DialogDescription>
                  {t(editingPromotion ? 'edit_modal.description' : 'add_modal.description')}
                  {ratePlans.length === 0 && <p className="text-destructive text-sm mt-2">{t(editingPromotion ? 'edit_modal.no_rate_plans_warning' : 'add_modal.no_rate_plans_warning')}</p>}
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
        ratePlans={ratePlans}
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
