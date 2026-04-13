"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '@/components/icons';
import { createClient } from '@supabase/supabase-js';
import type { Package, IncludedService, PackageCategory, PricingType, PricingLogic } from '@/types/package';

interface AddPackageFormProps {
  isOpen: boolean;
  onClose: () => void;
  package?: Package | null;
  propertyId: string;
  roomTypes: { id: string; name: string }[];
  services: { id: string; name: string }[];
  mealPlans: { id: string; name: string }[];
}

type FormData = Omit<Package, 'id' | 'createdAt' | 'updatedAt' | 'validFrom' | 'validTo'> & {
  validFrom: string;
  validTo: string;
};

export default function AddPackageForm({
  isOpen,
  onClose,
  package: existingPackage,
  propertyId,
  roomTypes: propsRoomTypes,
  services,
  mealPlans,
}: AddPackageFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUploadIndex, setImageUploadIndex] = useState<number | null>(null);
  const [roomTypesList, setRoomTypesList] = useState<{ id: string; name: string }[]>(propsRoomTypes);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    propertyId,
    name: '',
    shortDescription: '',
    fullDescription: '',
    images: [],
    packageCategory: 'stay_package' as PackageCategory,
    applicableRoomTypes: [],
    minimumNights: 1,
    maximumNights: null,
    includedMealPlanId: null,
    allowMealPlanUpgrade: false,
    includedServices: [],
    pricingType: 'fixed_price' as PricingType,
    packagePrice: 0,
    discountDisplay: '',
    pricingLogic: 'per_room' as PricingLogic,
    validFrom: '',
    validTo: '',
    blackoutDates: [],
    advanceBookingDays: 0,
    cancellationPolicy: '',
    stackableWithOffers: false,
    visibleOnBooking: false,
    visibleInGuestPortal: false,
    autoApply: false,
    featured: false,
    status: 'Draft',
  });

  useEffect(() => {
    if (existingPackage) {
      setFormData({
        ...existingPackage,
        validFrom: existingPackage.validFrom
          ? (typeof existingPackage.validFrom === 'string' 
              ? existingPackage.validFrom.split('T')[0]
              : new Date(existingPackage.validFrom).toISOString().split('T')[0])
          : '',
        validTo: existingPackage.validTo
          ? (typeof existingPackage.validTo === 'string' 
              ? existingPackage.validTo.split('T')[0]
              : new Date(existingPackage.validTo).toISOString().split('T')[0])
          : '',
      });
    }
  }, [existingPackage]);

  // Fetch room types when form opens or on step 2
  useEffect(() => {
    if ((isOpen || currentStep === 2) && propertyId) {
      const fetchRoomTypes = async () => {
        try {
          setLoadingRoomTypes(true);
          
          // Get Supabase session for auth token
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
          );
          
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await fetch(`/api/rooms/room-types/list?propertyId=${propertyId}`, {
            headers,
          });
          
          if (response.ok) {
            const data = await response.json();
            // Handle response format from API
            const roomTypesArray = data?.roomTypes || data || [];
            const transformed = roomTypesArray.map((rt: any) => ({
              id: rt.id,
              name: rt.name,
            }));
            setRoomTypesList(transformed);
          } else {
            console.error('Failed to fetch room types:', response.status);
            // Fall back to props if API fails
            setRoomTypesList(propsRoomTypes);
          }
        } catch (error) {
          console.error('Error fetching room types:', error);
          // Fall back to props if API fails
          setRoomTypesList(propsRoomTypes);
        } finally {
          setLoadingRoomTypes(false);
        }
      };

      fetchRoomTypes();
    }
  }, [isOpen, currentStep, propertyId, propsRoomTypes]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddImage = (url: string) => {
    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), url],
    }));
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleAddService = () => {
    setFormData((prev) => ({
      ...prev,
      includedServices: [
        ...prev.includedServices,
        { serviceId: '', quantity: 1, mandatory: true },
      ],
    }));
  };

  const handleUpdateService = (index: number, updates: Partial<IncludedService>) => {
    setFormData((prev) => ({
      ...prev,
      includedServices: prev.includedServices.map((service, i) =>
        i === index ? { ...service, ...updates } : service
      ),
    }));
  };

  const handleRemoveService = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      includedServices: prev.includedServices.filter((_, i) => i !== index),
    }));
  };

  const handleAddBlackoutDate = () => {
    const dateStr = prompt('Enter blackout date (YYYY-MM-DD):');
    if (dateStr) {
      setFormData((prev) => ({
        ...prev,
        blackoutDates: [...(prev.blackoutDates || []), dateStr],
      }));
    }
  };

  const handleRemoveBlackoutDate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      blackoutDates: prev.blackoutDates?.filter((_, i) => i !== index) || [],
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!formData.name && !!formData.packageCategory;
      case 2:
        return formData.applicableRoomTypes.length > 0 && formData.minimumNights > 0;
      case 3:
        return formData.packagePrice > 0;
      case 4:
      case 5:
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) return;

    setIsSubmitting(true);
    try {
      const dataToSave: any = {
        ...formData,
        validFrom: formData.validFrom || null,
        validTo: formData.validTo || null,
      };

      if (existingPackage) {
        // UPDATE
        const response = await fetch('/api/packages/crud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            propertyId,
            id: existingPackage.id,
            ...dataToSave,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update package');
        }
      } else {
        // CREATE
        const response = await fetch('/api/packages/crud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            propertyId,
            ...dataToSave,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create package');
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving package:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save package. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    { number: 1, title: 'Basics', icon: Icons.FileText },
    { number: 2, title: 'Included Items', icon: Icons.Package },
    { number: 3, title: 'Pricing', icon: Icons.DollarSign },
    { number: 4, title: 'Availability', icon: Icons.Calendar },
    { number: 5, title: 'Visibility', icon: Icons.Eye },
    { number: 6, title: 'Review', icon: Icons.CheckCircle2 },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {existingPackage ? 'Edit Package' : 'Create New Package'}
            </h2>
            <button onClick={onClose} className="rounded p-1 hover:bg-accent">
              <Icons.X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      currentStep === step.number
                        ? 'bg-primary text-primary-foreground'
                        : currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Icons.CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs font-medium">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-px flex-1 ${
                      currentStep > step.number ? 'bg-green-500' : 'bg-muted'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Step 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Package Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Romantic Getaway Package"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Package Type <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'stay_package', label: 'Stay Package', icon: Icons.BedDouble },
                    { value: 'experience_package', label: 'Experience Package', icon: Icons.Sparkles },
                    { value: 'seasonal_offer', label: 'Seasonal Offer', icon: Icons.CalendarDays },
                    { value: 'custom', label: 'Custom', icon: Icons.Settings },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleInputChange('packageCategory', type.value)}
                      className={`flex items-center gap-3 rounded-md border p-4 text-left transition-colors ${
                        formData.packageCategory === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <type.icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Short Description (Booking Page)
                </label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Brief description for booking page"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Description (Guest Portal)
                </label>
                <textarea
                  value={formData.fullDescription}
                  onChange={(e) => handleInputChange('fullDescription', e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Detailed description for guest portal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Images / Gallery</label>
                <div className="space-y-3">
                  {formData.images && formData.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {formData.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img}
                            alt={`Package image ${index + 1}`}
                            className="h-24 w-full rounded object-cover"
                          />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Icons.X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const url = prompt('Enter image URL:');
                      if (url) handleAddImage(url);
                    }}
                    className="w-full rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-accent"
                  >
                    <Icons.PlusCircle className="mx-auto h-5 w-5 mb-1" />
                    Add Image
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Included Items */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Applicable Room Types <span className="text-destructive">*</span>
                </label>
                {loadingRoomTypes ? (
                  <div className="flex items-center justify-center py-4">
                    <Icons.Spinner className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading room types...</span>
                  </div>
                ) : roomTypesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No room types available for this property. Please create room types first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {roomTypesList.map((rt) => (
                      <label key={rt.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.applicableRoomTypes.includes(rt.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleInputChange('applicableRoomTypes', [
                                ...formData.applicableRoomTypes,
                                rt.id,
                              ]);
                            } else {
                              handleInputChange(
                                'applicableRoomTypes',
                                formData.applicableRoomTypes.filter((id) => id !== rt.id)
                              );
                            }
                        }}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{rt.name}</span>
                    </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Minimum Nights <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minimumNights}
                    onChange={(e) => handleInputChange('minimumNights', parseInt(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Maximum Nights</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maximumNights || ''}
                    onChange={(e) =>
                      handleInputChange('maximumNights', e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Included Meal Plan</label>
                <select
                  value={formData.includedMealPlanId || ''}
                  onChange={(e) =>
                    handleInputChange('includedMealPlanId', e.target.value || null)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">None</option>
                  {mealPlans.map((mp) => (
                    <option key={mp.id} value={mp.id}>
                      {mp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allowMealPlanUpgrade}
                    onChange={(e) => handleInputChange('allowMealPlanUpgrade', e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm font-medium">Allow Meal Plan Upgrade</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Services & Experiences
                </label>
                <div className="space-y-3">
                  {formData.includedServices.map((service, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-md border p-3">
                      <select
                        value={service.serviceId}
                        onChange={(e) =>
                          handleUpdateService(index, { serviceId: e.target.value })
                        }
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select service...</option>
                        {services.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={service.quantity}
                        onChange={(e) =>
                          handleUpdateService(index, { quantity: parseInt(e.target.value) })
                        }
                        className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Qty"
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={service.mandatory}
                          onChange={(e) =>
                            handleUpdateService(index, { mandatory: e.target.checked })
                          }
                          className="rounded border-input"
                        />
                        <span className="text-xs">Mandatory</span>
                      </label>
                      <button
                        onClick={() => handleRemoveService(index)}
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Icons.Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddService}
                    className="w-full rounded-md border border-dashed border-input p-3 text-sm text-muted-foreground hover:bg-accent"
                  >
                    <Icons.PlusCircle className="mx-auto h-4 w-4 mb-1" />
                    Add Service
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Pricing */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Pricing Type <span className="text-destructive">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'fixed_price', label: 'Fixed Package Price', desc: 'Set a flat rate for the entire package' },
                    { value: 'discounted_bundle', label: 'Discounted Bundle', desc: 'Discount based on included items' },
                    { value: 'per_night_surcharge', label: 'Per Night Surcharge', desc: 'Additional charge per night' },
                  ].map((type) => (
                    <label
                      key={type.value}
                      className={`flex items-start gap-3 rounded-md border p-4 cursor-pointer ${
                        formData.pricingType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricingType"
                        value={type.value}
                        checked={formData.pricingType === type.value}
                        onChange={(e) => handleInputChange('pricingType', e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Package Price <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.packagePrice}
                    onChange={(e) => handleInputChange('packagePrice', parseFloat(e.target.value))}
                    className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Discount Display</label>
                <input
                  type="text"
                  value={formData.discountDisplay}
                  onChange={(e) => handleInputChange('discountDisplay', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Save 20%"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Pricing Logic <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-3">
                  <label className="flex flex-1 items-center gap-3 rounded-md border p-4 cursor-pointer">
                    <input
                      type="radio"
                      name="pricingLogic"
                      value="per_guest"
                      checked={formData.pricingLogic === 'per_guest'}
                      onChange={(e) => handleInputChange('pricingLogic', e.target.value)}
                    />
                    <div>
                      <div className="font-medium text-sm">Per Guest</div>
                      <div className="text-xs text-muted-foreground">Price per person</div>
                    </div>
                  </label>
                  <label className="flex flex-1 items-center gap-3 rounded-md border p-4 cursor-pointer">
                    <input
                      type="radio"
                      name="pricingLogic"
                      value="per_room"
                      checked={formData.pricingLogic === 'per_room'}
                      onChange={(e) => handleInputChange('pricingLogic', e.target.value)}
                    />
                    <div>
                      <div className="font-medium text-sm">Per Room</div>
                      <div className="text-xs text-muted-foreground">Flat rate per room</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Availability */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Valid From</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => handleInputChange('validFrom', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Valid To</label>
                  <input
                    type="date"
                    value={formData.validTo}
                    onChange={(e) => handleInputChange('validTo', e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Blackout Dates</label>
                <div className="space-y-2">
                  {formData.blackoutDates && formData.blackoutDates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.blackoutDates.map((date, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
                        >
                          {date}
                          <button
                            onClick={() => handleRemoveBlackoutDate(index)}
                            className="rounded-full hover:bg-background"
                          >
                            <Icons.X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleAddBlackoutDate}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add Blackout Date
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Advance Booking Days</label>
                <input
                  type="number"
                  min="0"
                  value={formData.advanceBookingDays}
                  onChange={(e) => handleInputChange('advanceBookingDays', parseInt(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0 = no restriction"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Cancellation Policy</label>
                <textarea
                  value={formData.cancellationPolicy}
                  onChange={(e) => handleInputChange('cancellationPolicy', e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Describe the cancellation policy for this package"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.stackableWithOffers}
                    onChange={(e) => handleInputChange('stackableWithOffers', e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm font-medium">Stackable with Other Offers</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Visibility */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="flex items-start gap-3 rounded-md border p-4">
                  <input
                    type="checkbox"
                    checked={formData.visibleOnBooking}
                    onChange={(e) => handleInputChange('visibleOnBooking', e.target.checked)}
                    className="mt-1 rounded border-input"
                  />
                  <div>
                    <div className="font-medium text-sm">Visible on Booking Page</div>
                    <div className="text-xs text-muted-foreground">
                      Show this package to guests during the booking process
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-md border p-4">
                  <input
                    type="checkbox"
                    checked={formData.visibleInGuestPortal}
                    onChange={(e) => handleInputChange('visibleInGuestPortal', e.target.checked)}
                    className="mt-1 rounded border-input"
                  />
                  <div>
                    <div className="font-medium text-sm">Visible in Guest Portal</div>
                    <div className="text-xs text-muted-foreground">
                      Allow guests to add this package after booking
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-md border p-4">
                  <input
                    type="checkbox"
                    checked={formData.autoApply}
                    onChange={(e) => handleInputChange('autoApply', e.target.checked)}
                    className="mt-1 rounded border-input"
                  />
                  <div>
                    <div className="font-medium text-sm">Auto-Apply Package</div>
                    <div className="text-xs text-muted-foreground">
                      Automatically include this package in qualifying bookings
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-md border p-4">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => handleInputChange('featured', e.target.checked)}
                    className="mt-1 rounded border-input"
                  />
                  <div>
                    <div className="font-medium text-sm">Highlight as Featured Package</div>
                    <div className="text-xs text-muted-foreground">
                      Display this package prominently on booking and portal pages
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Status <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-3">
                  <label className="flex flex-1 items-center gap-3 rounded-md border p-4 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Draft"
                      checked={formData.status === 'Draft'}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                    />
                    <div>
                      <div className="font-medium text-sm">Draft</div>
                      <div className="text-xs text-muted-foreground">Not visible to guests</div>
                    </div>
                  </label>
                  <label className="flex flex-1 items-center gap-3 rounded-md border p-4 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={formData.status === 'Active'}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                    />
                    <div>
                      <div className="font-medium text-sm">Active</div>
                      <div className="text-xs text-muted-foreground">Live and bookable</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="rounded-lg border p-6 space-y-4">
                <h3 className="text-lg font-semibold">Package Summary</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Name</div>
                    <div className="font-medium">{formData.name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Type</div>
                    <div className="font-medium capitalize">{formData.packageCategory.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Price</div>
                    <div className="font-medium">${formData.packagePrice}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Pricing Logic</div>
                    <div className="font-medium capitalize">{formData.pricingLogic.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Minimum Nights</div>
                    <div className="font-medium">{formData.minimumNights}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Room Types</div>
                    <div className="font-medium">{formData.applicableRoomTypes.length} selected</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Services</div>
                    <div className="font-medium">{formData.includedServices.length} included</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="font-medium">{formData.status}</div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit Basics
                  </button>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit Items
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit Pricing
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit Availability
                  </button>
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit Visibility
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex gap-3">
              {currentStep < 6 ? (
                <button
                  onClick={handleNext}
                  disabled={!validateStep(currentStep)}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      handleInputChange('status', 'Draft');
                      setTimeout(handleSubmit, 100);
                    }}
                    disabled={isSubmitting}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    onClick={() => {
                      handleInputChange('status', 'Active');
                      setTimeout(handleSubmit, 100);
                    }}
                    disabled={isSubmitting}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish Package'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
