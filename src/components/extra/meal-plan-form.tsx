
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
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
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Icons } from "@/components/icons";
import { UploadCloud, X } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, serverTimestamp, updateDoc, type FieldValue } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { MealPlan, MealPlanUnit } from '@/types/mealPlan';
import { mealPlanUnits } from '@/types/mealPlan';
import { uploadFile, deleteFile } from '@/lib/uploadHelper';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';


interface MealPlanFormProps {
    initialData: MealPlan | null;
    onClose: () => void;
}

export default function MealPlanForm({ initialData, onClose }: MealPlanFormProps) {
    const { user, property } = useAuth();
    const { t } = useTranslation('pages/extra/meal-plans/content');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState<string>('');
    const [unit, setUnit] = useState<MealPlanUnit>('per_night_per_guest');
    const [taxable, setTaxable] = useState(false);
    const [menuUrl, setMenuUrl] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDescription(initialData.description || '');
            setPrice(String(initialData.price));
            setUnit(initialData.unit);
            setTaxable(initialData.taxable);
            setMenuUrl(initialData.menuUrl || '');
            setImagePreview(initialData.imageUrl || null);
            setInitialImageUrl(initialData.imageUrl || null);
        } else {
            setName('');
            setDescription('');
            setPrice('');
            setUnit('per_night_per_guest');
            setTaxable(false);
            setMenuUrl('');
            setImageFile(null);
            setImagePreview(null);
            setInitialImageUrl(null);
        }
    }, [initialData]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const removeImage = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setImageFile(null);
        setImagePreview(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const getUnitLabel = (unitValue: MealPlanUnit) => {
        return t(`billing_units.${unitValue.replace(/_/g, '-')}`);
    };

    const handleSaveMealPlan = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user?.propertyId) {
            toast({ title: t('toasts.permission_denied.title'), description: t('toasts.permission_denied.description'), variant: "destructive" });
            return;
        }
        if (!name || price === '') {
            toast({ title: t('toasts.validation_error.title'), description: t('toasts.validation_error.description'), variant: "destructive" });
            return;
        }
        setIsLoading(true);

        let finalImageUrl = initialImageUrl;
        try {
            if (imageFile) {
                const pathPrefix = `properties/${user.propertyId}/mealPlans`;
                finalImageUrl = await uploadFile(pathPrefix, imageFile);
                if(initialImageUrl) {
                    await deleteFile(initialImageUrl).catch(e => console.warn("Old image deletion failed", e));
                }
            } else if (!imagePreview && initialImageUrl) {
                await deleteFile(initialImageUrl).catch(e => console.warn("Old image deletion failed", e));
                finalImageUrl = null;
            }

            const planData: Partial<Omit<MealPlan, 'id'>> & { updatedAt?: FieldValue, createdAt?: FieldValue } = {
                name,
                description,
                price: Number(price),
                unit,
                taxable,
                active: initialData ? initialData.active : true,
                propertyId: user.propertyId,
                menuUrl: menuUrl || null,
                imageUrl: finalImageUrl,
            };

            if (initialData) {
                const docRef = doc(db, "mealPlans", initialData.id);
                planData.updatedAt = serverTimestamp();
                await updateDoc(docRef, planData);
                toast({ title: t('toasts.update_success.title'), description: t('toasts.update_success.description') });
            } else {
                planData.createdAt = serverTimestamp();
                await addDoc(collection(db, "mealPlans"), planData as any);
                toast({ title: t('toasts.add_success.title'), description: t('toasts.add_success.description') });
            }
            onClose();

        } catch (error) {
            console.error("Error saving meal plan:", error);
            toast({ title: t('toasts.save_error.title'), description: t('toasts.save_error.description'), variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <form onSubmit={handleSaveMealPlan}>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-1">
                    <Label htmlFor="plan-name">{t('form.name_label')} <span className="text-destructive">{t('form.required_field_indicator')}</span></Label>
                    <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('form.name_placeholder')}/>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="plan-description">{t('form.description_label')}</Label>
                    <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.description_placeholder')}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="plan-price">{t('form.price_label')} ({property?.currency || '$'}) <span className="text-destructive">{t('form.required_field_indicator')}</span></Label>
                        <Input id="plan-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0" step="0.01" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="plan-unit">{t('form.billing_unit_label')}</Label>
                        <Select value={unit} onValueChange={(value) => setUnit(value as MealPlanUnit)}>
                        <SelectTrigger id="plan-unit"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {mealPlanUnits.map(u => <SelectItem key={u} value={u}>{getUnitLabel(u)}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="plan-menu-url">{t('form.menu_url_label')}</Label>
                    <Input id="plan-menu-url" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} placeholder={t('form.menu_url_placeholder')}/>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="plan-image">{t('form.image_label')}</Label>
                    <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary" onClick={() => imageInputRef.current?.click()}>
                        <div className="space-y-1 text-center">
                        {imagePreview ? (
                            <div className="relative group w-32 h-24 mx-auto">
                                <Image src={imagePreview} alt="Image preview" layout="fill" objectFit="cover" className="rounded-md"/>
                                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 z-10" onClick={removeImage}> <X className="h-4 w-4"/> </Button>
                            </div>
                        ) : (
                            <>
                            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">{t('form.image_upload_text')}</p>
                            <p className="text-xs text-muted-foreground">{t('form.image_upload_subtext')}</p>
                            </>
                        )}
                        </div>
                        <Input ref={imageInputRef} id="plan-image" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" />
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="plan-taxable" checked={taxable} onCheckedChange={setTaxable} />
                    <Label htmlFor="plan-taxable">{t('form.taxable_label')}</Label>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">{t('buttons.cancel')}</Button></DialogClose>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                    {t('buttons.save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
