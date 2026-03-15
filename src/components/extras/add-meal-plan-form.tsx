"use client";

import React, { useState, useEffect } from 'react';
import { Icons } from '@/components/icons';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

interface MealPlanFormData {
  name: string;
  shortDescription: string;
  fullDescription: string;
  categoryId: string;
  subcategoryId: string;
  mealPlanType: string;
  includedMeals: string[];
  pricingModel: string;
  basePrice: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  infantFree: boolean;
  enableAgePricing: boolean;
  availableDates: { start: string; end: string } | null;
  minimumStay: number;
  blackoutDates: string[];
  cancellationPolicy: string;
  upgradeAllowed: boolean;
  applicableRoomTypes: string[];
  applicableRatePlans: Record<string, string[]>;
  isDefault: boolean;
  visibleOnBooking: boolean;
  visibleInGuestPortal: boolean;
  status: 'Active' | 'Draft' | 'Archived';
  images: string[];
}

interface AddMealPlanFormProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  categories: Category[];
  mealPlanToEdit?: any;
}

const STEPS = [
  'Classification',
  'Information',
  'Pricing',
  'Availability',
  'Room Linking',
  'Review'
];

const MEAL_PLAN_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'half-board', label: 'Half Board' },
  { value: 'full-board', label: 'Full Board' },
  { value: 'all-inclusive', label: 'All Inclusive' },
  { value: 'custom', label: 'Custom' },
];

const PRICING_MODELS = [
  { value: 'per-guest-night', label: 'Per Guest / Night', description: 'Charge per person per night' },
  { value: 'per-room-night', label: 'Per Room / Night', description: 'Charge per room per night' },
  { value: 'flat-rate', label: 'Flat Rate per Stay', description: 'One-time charge for entire stay' },
];

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'drinks', label: 'Drinks' },
];

export default function AddMealPlanForm({ isOpen, onClose, propertyId, categories, mealPlanToEdit }: AddMealPlanFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<{ id: string; name: string }[]>([]);
  const [availableRatePlans, setAvailableRatePlans] = useState<{ id: string; name: string; roomTypeId?: string }[]>([]);

  const [formData, setFormData] = useState<MealPlanFormData>({
    name: '',
    shortDescription: '',
    fullDescription: '',
    categoryId: '',
    subcategoryId: '',
    mealPlanType: 'breakfast',
    includedMeals: [],
    pricingModel: 'per-guest-night',
    basePrice: 0,
    adultPrice: 0,
    childPrice: 0,
    infantPrice: 0,
    infantFree: true,
    enableAgePricing: false,
    availableDates: null,
    minimumStay: 0,
    blackoutDates: [],
    cancellationPolicy: '',
    upgradeAllowed: true,
    applicableRoomTypes: [],
    applicableRatePlans: {},
    isDefault: false,
    visibleOnBooking: true,
    visibleInGuestPortal: true,
    status: 'Draft',
    images: [],
  });

  useEffect(() => {
    if (mealPlanToEdit) {
      setFormData({
        name: mealPlanToEdit.name || '',
        shortDescription: mealPlanToEdit.shortDescription || '',
        fullDescription: mealPlanToEdit.fullDescription || '',
        categoryId: mealPlanToEdit.categoryId || '',
        subcategoryId: mealPlanToEdit.subcategoryId || '',
        mealPlanType: mealPlanToEdit.mealPlanType || 'breakfast',
        includedMeals: mealPlanToEdit.includedMeals || [],
        pricingModel: mealPlanToEdit.pricingModel || 'per-guest-night',
        basePrice: mealPlanToEdit.basePrice || 0,
        adultPrice: mealPlanToEdit.adultPrice || 0,
        childPrice: mealPlanToEdit.childPrice || 0,
        infantPrice: mealPlanToEdit.infantPrice || 0,
        infantFree: mealPlanToEdit.infantFree ?? true,
        enableAgePricing: mealPlanToEdit.enableAgePricing || false,
        availableDates: mealPlanToEdit.availableDates || null,
        minimumStay: mealPlanToEdit.minimumStay || 0,
        blackoutDates: mealPlanToEdit.blackoutDates || [],
        cancellationPolicy: mealPlanToEdit.cancellationPolicy || '',
        upgradeAllowed: mealPlanToEdit.upgradeAllowed ?? true,
        applicableRoomTypes: mealPlanToEdit.applicableRoomTypes || [],
        applicableRatePlans: mealPlanToEdit.applicableRatePlans || {},
        isDefault: mealPlanToEdit.isDefault || false,
        visibleOnBooking: mealPlanToEdit.visibleOnBooking ?? true,
        visibleInGuestPortal: mealPlanToEdit.visibleInGuestPortal ?? true,
        status: mealPlanToEdit.status || 'Draft',
        images: mealPlanToEdit.images || [],
      });
      if (mealPlanToEdit.images && mealPlanToEdit.images.length > 0) {
        setImagePreviews(mealPlanToEdit.images);
      }
    }
  }, [mealPlanToEdit]);

  useEffect(() => {
    if (!propertyId) return;
    const rtCol = collection(db, 'roomTypes');
    const rtQ = query(rtCol, where('propertyId', '==', propertyId));
    const unsub = onSnapshot(rtQ, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Unnamed' }));
      setAvailableRoomTypes(items);
    });
    return () => unsub();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    const rpCol = collection(db, 'ratePlans');
    const rpQ = query(rpCol, where('propertyId', '==', propertyId));
    const unsub = onSnapshot(rpQ, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).planName || (d.data() as any).name || 'Unnamed', roomTypeId: (d.data() as any).roomTypeId || (d.data() as any).roomType }));
      setAvailableRatePlans(items);
    });
    return () => unsub();
  }, [propertyId]);

  const updateField = <K extends keyof MealPlanFormData>(field: K, value: MealPlanFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateRatePlansForRoomType = (roomTypeId: string, selected: string[]) => {
    setFormData(prev => ({ ...prev, applicableRatePlans: { ...(prev.applicableRatePlans || {}), [roomTypeId]: selected } }));
  };

  const toggleMeal = (meal: string) => {
    setFormData(prev => ({
      ...prev,
      includedMeals: prev.includedMeals.includes(meal)
        ? prev.includedMeals.filter(m => m !== meal)
        : [...prev.includedMeals, meal]
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImageFiles(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    if (formData.images[index]) {
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0: // Classification
        return formData.categoryId && formData.mealPlanType;
      case 1: // Information
        return formData.name.trim();
      case 2: // Pricing
        return formData.pricingModel && (formData.basePrice > 0 || formData.adultPrice > 0);
      case 3: // Availability & Rules: if dates enabled and not open-ended, require start+end
        if (formData.availableDates !== null) {
          const start = formData.availableDates?.start || '';
          const end = formData.availableDates?.end || '';
          if (!start) return false;
          if (end === '') return true; // open-ended allowed
          return !!end && end >= start;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep() && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    setSaving(true);
    try {
      // Upload images
      const uploadedUrls: string[] = [...formData.images];
      for (const file of imageFiles) {
        const storageRef = ref(storage, `mealPlans/${propertyId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      const mealPlanData = {
        ...formData,
        images: uploadedUrls,
        status: asDraft ? 'Draft' : formData.status,
        propertyId,
        updatedAt: serverTimestamp(),
      };

      if (mealPlanToEdit) {
        await updateDoc(doc(db, 'mealPlans', mealPlanToEdit.id), mealPlanData);
      } else {
        await addDoc(collection(db, 'mealPlans'), {
          ...mealPlanData,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving meal plan:', err);
      alert('Failed to save meal plan');
    } finally {
      setSaving(false);
    }
  };

  const parentCategories = categories.filter(c => !c.parentId);
  const subcategories = categories.filter(c => c.parentId === formData.categoryId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {mealPlanToEdit ? 'Edit Meal Plan' : 'Add New Meal Plan'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    idx === currentStep
                      ? 'bg-white text-primary scale-110'
                      : idx < currentStep
                      ? 'bg-white/80 text-primary'
                      : 'bg-white/20 text-white/60'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className={`text-xs mt-1 font-medium transition-opacity ${
                    idx === currentStep ? 'opacity-100' : 'opacity-60'
                  }`}>
                    {step}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 transition-all ${
                    idx < currentStep ? 'bg-white/80' : 'bg-white/20'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)]">
          {/* Step 1: Classification */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Meal Plan Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {parentCategories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => {
                        updateField('categoryId', category.id);
                        updateField('mealPlanType', category.id);
                      }}
                      className={`p-4 border-2 rounded-xl font-medium transition-all ${
                        formData.categoryId === category.id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {parentCategories.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">
                    No categories available. Please create categories from the Categories tab first.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Meal Plan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Continental Breakfast"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Short Description (Booking Page)
                </label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) => updateField('shortDescription', e.target.value)}
                  placeholder="Brief description for booking page..."
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Full Description (Guest Portal)
                </label>
                <textarea
                  value={formData.fullDescription}
                  onChange={(e) => updateField('fullDescription', e.target.value)}
                  placeholder="Detailed description for guest portal..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Included Meals
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {MEAL_OPTIONS.map(meal => (
                    <label
                      key={meal.value}
                      className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.includedMeals.includes(meal.value)
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.includedMeals.includes(meal.value)}
                        onChange={() => toggleMeal(meal.value)}
                        className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="font-medium text-slate-700">{meal.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Images (Optional)
                </label>
                <div className="space-y-3">
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {imagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border-2 border-slate-200">
                          <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <Icons.X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-xl hover:border-primary hover:bg-primary/5 cursor-pointer transition-all">
                    <Icons.UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Click to upload images</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Pricing Configuration */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Pricing Model <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {PRICING_MODELS.map(model => (
                    <label
                      key={model.value}
                      className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.pricingModel === model.value
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricingModel"
                        checked={formData.pricingModel === model.value}
                        onChange={() => updateField('pricingModel', model.value)}
                        className="mt-1 w-5 h-5 text-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{model.label}</div>
                        <div className="text-sm text-slate-500">{model.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <input
                  type="checkbox"
                  checked={formData.enableAgePricing}
                  onChange={(e) => updateField('enableAgePricing', e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                />
                <label className="font-medium text-slate-700">
                  Enable Age-Based Pricing
                </label>
              </div>

              {!formData.enableAgePricing ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Base Price <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-600">$</span>
                    <input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => updateField('basePrice', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-2xl font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Adult Price <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-slate-600">$</span>
                      <input
                        type="number"
                        value={formData.adultPrice}
                        onChange={(e) => updateField('adultPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Child Price
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-slate-600">$</span>
                      <input
                        type="number"
                        value={formData.childPrice}
                        onChange={(e) => updateField('childPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Infant Price
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.infantFree}
                          onChange={(e) => updateField('infantFree', e.target.checked)}
                          className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-sm text-slate-600">Free</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-slate-600">$</span>
                      <input
                        type="number"
                        value={formData.infantPrice}
                        onChange={(e) => updateField('infantPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        disabled={formData.infantFree}
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Availability & Rules */}
          {currentStep === 3 && (
            <div className="space-y-6">
                {/* Applicable room types moved to Step 5 */}
              

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Valid Dates</label>
                  <label className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={formData.availableDates !== null}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateField('availableDates', { start: '', end: '' });
                        } else {
                          updateField('availableDates', null);
                        }
                      }}
                      className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-sm text-slate-700">Enable date limits for this meal plan</span>
                  </label>

                  {formData.availableDates !== null ? (
                    <>
                      <div className="flex gap-3 items-center">
                        <input
                          type="date"
                          value={formData.availableDates?.start || ''}
                          onChange={(e) => updateField('availableDates', { start: e.target.value, end: formData.availableDates?.end ?? '' })}
                          className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-sm text-slate-500">to</span>
                        <input
                          type="date"
                          value={formData.availableDates?.end || ''}
                          onChange={(e) => updateField('availableDates', { start: formData.availableDates?.start || '', end: e.target.value })}
                          disabled={formData.availableDates?.end === ''}
                          className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50"
                        />
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={formData.availableDates?.end === ''}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateField('availableDates', { start: formData.availableDates?.start || '', end: '' });
                            } else {
                              // when toggling off open-ended, initialize end to start by default
                              updateField('availableDates', { start: formData.availableDates?.start || '', end: formData.availableDates?.start || '' });
                            }
                          }}
                          className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                        />
                        <span>No end date (open-ended)</span>
                      </label>
                      <p className="text-sm text-slate-500 mt-2">If open-ended is unchecked, an end date must be selected.</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No date limits — this meal plan is always valid.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Cancellation Policy
                  </label>
                  <textarea
                    value={formData.cancellationPolicy}
                    onChange={(e) => updateField('cancellationPolicy', e.target.value)}
                    placeholder="Describe the cancellation policy..."
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

              
            </div>
          )}

          {/* Step 5: Room & Channel Linking */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => updateField('isDefault', e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                />
                <label className="font-medium text-slate-700">
                  Set as Default Meal Plan
                </label>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-primary/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.visibleOnBooking}
                    onChange={(e) => updateField('visibleOnBooking', e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Visible on Booking Page</div>
                    <div className="text-sm text-slate-500">Show this meal plan to guests booking directly</div>
                  </div>
                  <Icons.Globe className="w-5 h-5 text-slate-400" />
                </label>

                <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-primary/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.visibleInGuestPortal}
                    onChange={(e) => updateField('visibleInGuestPortal', e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Visible in Guest Portal</div>
                    <div className="text-sm text-slate-500">Allow current guests to add/upgrade this meal plan</div>
                  </div>
                  <Icons.User className="w-5 h-5 text-slate-400" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Applicable Room Types
                </label>
                {availableRoomTypes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {availableRoomTypes.map(rt => {
                      const ratePlansForRt = availableRatePlans.filter(rp => rp.roomTypeId === rt.id);
                      const selectedRatePlans = formData.applicableRatePlans?.[rt.id] || [];
                      return (
                        <div key={rt.id} className="p-3 border rounded-xl">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={formData.applicableRoomTypes.includes(rt.id)}
                              onChange={() => {
                                const exists = formData.applicableRoomTypes.includes(rt.id);
                                updateField('applicableRoomTypes', exists ? formData.applicableRoomTypes.filter(id => id !== rt.id) : [...formData.applicableRoomTypes, rt.id]);
                              }}
                              className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                            />
                            <div className="text-sm text-slate-700 font-medium">{rt.name}</div>
                          </label>

                          {ratePlansForRt.length > 0 ? (
                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <div className="block text-sm text-slate-600 mb-2">Select Rate Plans (applies to this room type)</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {ratePlansForRt.map(rp => (
                                  <label key={rp.id} className="flex items-center gap-3 p-3 border rounded-xl hover:border-primary/30 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedRatePlans.includes(rp.id)}
                                      onChange={(e) => {
                                        const exists = selectedRatePlans.includes(rp.id);
                                        const newSelected = exists ? selectedRatePlans.filter(id => id !== rp.id) : [...selectedRatePlans, rp.id];
                                        updateRatePlansForRoomType(rt.id, newSelected);
                                      }}
                                      className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                                    />
                                    <div className="text-sm text-slate-700">{rp.name}</div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 mt-2">No rate plans configured for this room type — will apply to entire room type</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No room types configured — applies to all room types</p>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{formData.name || 'Untitled Meal Plan'}</h3>
                {formData.shortDescription && (
                  <p className="text-slate-600 mb-4">{formData.shortDescription}</p>
                )}
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-sm text-slate-500">Type</div>
                    <div className="font-semibold text-slate-900">{MEAL_PLAN_TYPES.find(t => t.value === formData.mealPlanType)?.label}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Pricing</div>
                    <div className="font-semibold text-slate-900">{PRICING_MODELS.find(m => m.value === formData.pricingModel)?.label}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Price</div>
                    <div className="text-2xl font-bold text-primary">
                      ${formData.enableAgePricing ? formData.adultPrice.toFixed(2) : formData.basePrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Included Meals</div>
                  <div className="flex flex-wrap gap-2">
                    {formData.includedMeals.length > 0 ? (
                      formData.includedMeals.map(meal => (
                        <span key={meal} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-700 border border-slate-200">
                          {MEAL_OPTIONS.find(m => m.value === meal)?.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">None selected</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Visibility</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {formData.visibleOnBooking ? (
                        <Icons.CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Icons.XCircle className="w-4 h-4 text-slate-300" />
                      )}
                      <span className="text-slate-700">Booking Page</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {formData.visibleInGuestPortal ? (
                        <Icons.CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Icons.XCircle className="w-4 h-4 text-slate-300" />
                      )}
                      <span className="text-slate-700">Guest Portal</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Publication Status
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Draft', 'Active', 'Archived'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateField('status', status as any)}
                      className={`p-4 border-2 rounded-xl font-medium transition-all ${
                        formData.status === status
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              {currentStep === STEPS.length - 1 && (
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={saving}
                  className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-white transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              )}
              
              {currentStep < STEPS.length - 1 ? (
                <button
                  onClick={nextStep}
                  disabled={!validateStep()}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <Icons.ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={saving}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Icons.Spinner className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icons.CheckCircle2 className="w-5 h-5" />
                      {mealPlanToEdit ? 'Update' : 'Publish'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
