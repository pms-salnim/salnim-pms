
"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/icons";
import { MoreHorizontal, PlusCircle, Edit, Trash2, UploadCloud, X } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, type FieldValue } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { MealPlan, MealPlanUnit } from '@/types/mealPlan';
import { mealPlanUnits } from '@/types/mealPlan';
import type { Property } from '@/types/property';
import Image from 'next/image';
import { uploadFile, deleteFile } from '@/lib/uploadHelper';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';

const MealPlanForm = dynamic(() => import('@/components/extra/meal-plan-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


export default function MealPlansPage() {
  const { user, isLoadingAuth } = useAuth();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMealPlan, setEditingMealPlan] = useState<MealPlan | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<MealPlan | null>(null);

  const { t } = useTranslation('pages/extra/meal-plans/content');

  const canManage = user?.permissions?.extras;

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setMealPlans([]);
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

    const mealPlansColRef = collection(db, "mealPlans");
    const q = query(mealPlansColRef, where("propertyId", "==", propertyId));
    const unsubMealPlans = onSnapshot(q, (snapshot) => {
      const fetchedPlans = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as MealPlan));
      setMealPlans(fetchedPlans);
      setIsLoading(false);
    });
    
    return () => {
      unsubMealPlans();
      unsubProp();
    };
  }, [propertyId]);
  

  const handleOpenModal = (plan: MealPlan | null = null) => {
    if (!canManage) return;
    setEditingMealPlan(plan);
    setIsModalOpen(true);
  };
  
  const handleToggleStatus = async (plan: MealPlan) => {
    if (!canManage) return;
    try {
      const docRef = doc(db, "mealPlans", plan.id);
      await updateDoc(docRef, { active: !plan.active });
      toast({ title: t('toasts.status_update_success.title'), description: t('toasts.status_update_success.description', { name: plan.name, status: !plan.active ? t('status.active') : t('status.inactive') }) });
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({ title: t('toasts.status_update_error.title'), description: t('toasts.status_update_error.description'), variant: "destructive" });
    }
  };

  const handleDeleteMealPlan = (plan: MealPlan) => {
    if (!canManage) return;
    setPlanToDelete(plan);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!planToDelete || !canManage) return;
    try {
      if (planToDelete.imageUrl) {
        await deleteFile(planToDelete.imageUrl).catch(e => console.warn("Could not delete associated image", e));
      }
      await deleteDoc(doc(db, "mealPlans", planToDelete.id));
      toast({ title: t('toasts.delete_success.title'), description: t('toasts.delete_success.description') });
    } catch (error) {
      console.error("Error deleting meal plan:", error);
      toast({ title: t('toasts.delete_error.title'), description: t('toasts.delete_error.description'), variant: "destructive" });
    } finally {
        setPlanToDelete(null);
        setIsDeleteDialogOpen(false);
    }
  };
  
  const getUnitLabel = (unitValue: MealPlanUnit) => {
    return t(`billing_units.${unitValue.replace(/_/g, '-')}`);
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.extras) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>{t('access_denied.description')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) setEditingMealPlan(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenModal()} disabled={!canManage}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingMealPlan ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
                <DialogDescription>{t('add_modal.description')}</DialogDescription>
              </DialogHeader>
              <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin"/></div>}>
                <MealPlanForm 
                    initialData={editingMealPlan}
                    onClose={() => setIsModalOpen(false)}
                />
              </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('table.title')}</CardTitle>
          <CardDescription>{t('table.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 hidden sm:table-cell">{t('table.headers.image')}</TableHead>
                  <TableHead>{t('table.headers.name')}</TableHead>
                  <TableHead>{t('table.headers.price')}</TableHead>
                  <TableHead>{t('table.headers.status')}</TableHead>
                  <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                ) : mealPlans.length > 0 ? (
                  mealPlans.map((plan) => (
                    <TableRow key={plan.id}>
                       <TableCell className="hidden sm:table-cell">
                         <Image src={plan.imageUrl || `https://placehold.co/100x75.png`} alt={plan.name} width={64} height={48} className="rounded-md object-cover h-12 w-16" data-ai-hint="food meal"/>
                      </TableCell>
                      <TableCell className="font-medium">
                        {plan.name}
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{plan.description}</p>
                      </TableCell>
                      <TableCell>
                        {propertySettings?.currency || '$'}{plan.price.toFixed(2)}
                        <p className="text-xs text-muted-foreground">{getUnitLabel(plan.unit)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.active ? 'default' : 'outline'} className={plan.active ? 'bg-green-100 text-green-700 border-green-300' : ''}>
                          {plan.active ? t('status.active') : t('status.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenModal(plan)}><Edit className="mr-2 h-4 w-4" /> {t('actions_menu.edit')}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(plan)}><Icons.Power className="mr-2 h-4 w-4" /> {plan.active ? t('actions_menu.deactivate') : t('actions_menu.activate')}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMealPlan(plan)}><Trash2 className="mr-2 h-4 w-4" /> {t('actions_menu.delete')}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">{t('table.empty_state')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { name: planToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPlanToDelete(null)}>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>
                {isLoading ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/> : null}
                {t('delete_dialog.continue_button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
