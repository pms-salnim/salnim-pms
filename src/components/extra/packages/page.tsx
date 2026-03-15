
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import PackageList from "@/components/extra/package-list";
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
import type { Package } from '@/types/package';
import type { RoomType } from '@/types/roomType';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

const PackageForm = dynamic(() => import('@/components/extra/package-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


export default function PackagesPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/extra/packages/content');
  const [packages, setPackages] = useState<Package[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);

  const canManage = user?.permissions?.extras;
  const propertyId = user?.propertyId;

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    let listenersCount = 4;
    const doneLoading = () => {
        listenersCount--;
        if (listenersCount === 0) setIsLoading(false);
    }

    const unsubPackages = onSnapshot(query(collection(db, "packages"), where("propertyId", "==", propertyId)), (snapshot) => {
      setPackages(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Package)));
      doneLoading();
    });
    const unsubRoomTypes = onSnapshot(query(collection(db, "roomTypes"), where("propertyId", "==", propertyId)), (snapshot) => {
      setRoomTypes(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RoomType)));
      doneLoading();
    });
    const unsubServices = onSnapshot(query(collection(db, "services"), where("propertyId", "==", propertyId), where("active", "==", true)), (snapshot) => {
      setServices(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Service)));
      doneLoading();
    });
    const unsubMealPlans = onSnapshot(query(collection(db, "mealPlans"), where("propertyId", "==", propertyId), where("active", "==", true)), (snapshot) => {
      setMealPlans(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as MealPlan)));
      doneLoading();
    });

    return () => {
      unsubPackages();
      unsubRoomTypes();
      unsubServices();
      unsubMealPlans();
    };
  }, [propertyId]);

  const handleOpenModal = (pkg: Package | null = null) => {
    if (!canManage) return;
    setEditingPackage(pkg);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
  };

  const handleSavePackage = async (formData: Omit<Package, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>) => {
    if (!propertyId || !canManage) {
      toast({ title: t('toasts.permission_denied.title'), description: t('toasts.permission_denied.description'), variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const dataToSave = {
      ...formData,
      propertyId,
    };

    try {
      if (editingPackage) {
        const docRef = doc(db, "packages", editingPackage.id);
        await updateDoc(docRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.save_success.title'), description: t('toasts.save_success.update_description') });
      } else {
        await addDoc(collection(db, "packages"), { ...dataToSave, createdAt: serverTimestamp(), active: true });
        toast({ title: t('toasts.save_success.title'), description: t('toasts.save_success.add_description') });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving package:", error);
      toast({ title: t('toasts.save_error.title'), description: t('toasts.save_error.description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleStatus = async (pkg: Package) => {
    if (!canManage) return;
    try {
      const docRef = doc(db, "packages", pkg.id);
      await updateDoc(docRef, { active: !pkg.active });
      toast({ title: t('toasts.status_update_success.title'), description: t('toasts.status_update_success.description', { name: pkg.name, status: !pkg.active ? t('status.active') : t('status.inactive') }) });
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({ title: t('toasts.status_update_error.title'), description: t('toasts.status_update_error.description'), variant: "destructive" });
    }
  };

  const handleDeletePackage = (pkg: Package) => {
    if (!canManage) return;
    setPackageToDelete(pkg);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeletePackage = async () => {
    if (!packageToDelete) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "packages", packageToDelete.id));
      toast({ title: t('toasts.delete_success.title'), description: t('toasts.delete_success.description') });
    } catch (error) {
      console.error("Error deleting package:", error);
      toast({ title: t('toasts.delete_error.title'), description: t('toasts.delete_error.description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setPackageToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.extras) {
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
            <Button onClick={() => handleOpenModal()} disabled={!canManage || roomTypes.length === 0}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingPackage ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
              <DialogDescription>
                {t('add_modal.description')}
                {roomTypes.length === 0 && <p className="text-destructive text-sm mt-2">{t('add_modal.no_rate_plans_warning')}</p>}
              </DialogDescription>
            </DialogHeader>
            <PackageForm
              initialData={editingPackage}
              roomTypes={roomTypes}
              services={services}
              mealPlans={mealPlans}
              onSave={handleSavePackage}
              onClose={handleCloseModal}
            />
          </DialogContent>
        </Dialog>
      </div>

      <PackageList
        packages={packages}
        roomTypes={roomTypes}
        services={services}
        mealPlans={mealPlans}
        onEdit={handleOpenModal}
        onDelete={handleDeletePackage}
        onToggleStatus={handleToggleStatus}
        isLoading={isLoading}
        canManage={canManage}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { name: packageToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPackageToDelete(null)}>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePackage} disabled={isLoading}>
                {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                {t('delete_dialog.continue_button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
