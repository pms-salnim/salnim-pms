
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
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/types/firestoreUser';
import type { RatePlan } from '@/types/ratePlan';
import type { RoomType } from '@/types/roomType';
import { Icons } from '@/components/icons';
import type { Property } from '@/types/property';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

const RatePlanForm = dynamic(() => import('@/components/rate-plans/rate-plan-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


export default function AllRatePlansPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/rate-plans/all/content');
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRatePlan, setEditingRatePlan] = useState<RatePlan | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [ratePlanToDelete, setRatePlanToDelete] = useState<RatePlan | null>(null);

  const [filters, setFilters] = useState({
    searchTerm: '',
    roomTypeId: 'all',
    status: 'all',
  });
  
  const canManage = user?.permissions?.ratePlans;

  useEffect(() => {
    if (user?.id) {
      const staffDocRef = doc(db, "staff", user.id);
      const unsubStaff = onSnapshot(staffDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const staffData = docSnap.data() as FirestoreUser;
          setPropertyId(staffData.propertyId);
        } else {
          setPropertyId(null);
          toast({ title: "Error", description: "Could not load property information.", variant: "destructive" });
        }
      });
      return () => unsubStaff();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!propertyId) {
      setRatePlans([]);
      setRoomTypes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPropertySettings(docSnap.data() as Property);
      }
    });

    const roomTypesColRef = collection(db, "roomTypes");
    const rtq = query(roomTypesColRef, where("propertyId", "==", propertyId));
    const unsubRoomTypes = onSnapshot(rtq, (snapshot) => {
      const fetchedRoomTypes = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RoomType));
      setRoomTypes(fetchedRoomTypes);
    }, (error) => {
      console.error("Error fetching room types:", error);
      toast({ title: "Error", description: "Could not fetch room types.", variant: "destructive" });
    });

    const ratePlansColRef = collection(db, "ratePlans");
    const rpq = query(ratePlansColRef, where("propertyId", "==", propertyId));
    const unsubRatePlans = onSnapshot(rpq, (snapshot) => {
      const fetchedRatePlans = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as RatePlan));
      setRatePlans(fetchedRatePlans);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching rate plans:", error);
      toast({ title: "Error", description: "Could not fetch rate plans.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => {
      unsubRoomTypes();
      unsubRatePlans();
      unsubProp();
    };
  }, [propertyId]);

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
    if (!propertyId || !user?.id || !canManage) {
      toast({ title: "Error", description: "Permission denied or property/user not identified.", variant: "destructive" });
      return;
    }

    const dataToSave = {
      ...formData,
      propertyId,
    };

    setIsLoading(true);
    try {
      const batch = writeBatch(db);

      if (dataToSave.default) {
        const plansForRoomTypeQuery = query(
          collection(db, "ratePlans"),
          where("propertyId", "==", propertyId),
          where("roomTypeId", "==", dataToSave.roomTypeId),
          where("default", "==", true)
        );
        const querySnapshot = await getDocs(plansForRoomTypeQuery);
        querySnapshot.forEach(docSnap => {
          if (docSnap.id !== editingRatePlan?.id) { 
            batch.update(doc(db, "ratePlans", docSnap.id), { default: false });
          }
        });
      }


      if (editingRatePlan) {
        const docRef = doc(db, "ratePlans", editingRatePlan.id);
        batch.update(docRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.success_update_title'), description: t('toasts.success_update_description') });
      } else {
        const newPlanRef = doc(collection(db, "ratePlans"));
        batch.set(newPlanRef, { ...dataToSave, createdBy: user.id, createdAt: serverTimestamp() });
        toast({ title: t('toasts.success_create_title'), description: t('toasts.success_create_description') });
      }
      await batch.commit();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving rate plan:", error);
      toast({ title: t('toasts.error_save_title'), description: t('toasts.error_save_description'), variant: "destructive" });
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
    if (!ratePlanToDelete) return;
    setIsLoading(true); 
    try {
      await deleteDoc(doc(db, "ratePlans", ratePlanToDelete.id));
      toast({ title: t('toasts.success_delete_title'), description: t('toasts.success_delete_description') });
    } catch (error) {
      console.error("Error deleting rate plan from Firestore (ID:", ratePlanToDelete.id, "):", error);
      toast({ title: t('toasts.error_delete_title'), description: t('toasts.error_delete_description'), variant: "destructive" });
    } finally {
      setIsLoading(false); 
      setRatePlanToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };
  
  if (isLoadingAuth || (isLoading && !propertyId)) {
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
            <Button onClick={() => handleOpenModal()} disabled={!propertyId || roomTypes.length === 0 || !canManage}>
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
              {propertyId && roomTypes.length > 0 && (
                <RatePlanForm
                  initialData={editingRatePlan}
                  availableRoomTypes={roomTypes}
                  onSave={handleSaveRatePlan}
                  onClose={handleCloseModal}
                  propertyId={propertyId}
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
