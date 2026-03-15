"use client";

import React, { useState, useEffect } from 'react';
import { Icons } from '@/components/icons';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

interface ServiceVariation {
  label: string;
  adultPrice: number;
  childPrice: number;
}

interface ItineraryStep {
  time: string;
  activity: string;
  location: string;
}

interface ServiceFormData {
  // Classification
  primaryCategory: string;
  subCategory: string;
  bookingEngine: boolean;
  guestPortal: boolean;
  staffOnly: boolean;
  
  // Content
  displayName: string;
  shortDescription: string;
  longDescription: string;
  circuitItinerary: ItineraryStep[];
  tags: string[];
  
  // Pricing
  pricingMode: 'base' | 'variations';
  basePrice: number;
  pricingType: 'one-time-per-guest' | 'per-guest-per-night' | 'per-reservation' | 'per-night' | 'per-guest';
  variations: ServiceVariation[];
  
  // Logistics
  unlimitedMode: boolean;
  maxPeople: number;
  cutoffTime: number;
  status: 'Active' | 'Draft' | 'Archived';
  
  // Media
  images: File[];
  featuredImageIndex: number;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  price?: number;
  currency?: string;
  pricingType?: 'one-time-per-guest' | 'per-guest-per-night' | 'per-reservation' | 'per-night' | 'per-guest';
  categoryId?: string;
  subcategoryId?: string;
  primaryCategory?: string;
  subCategory?: string;
  bookingEngine?: boolean;
  guestPortal?: boolean;
  staffOnly?: boolean;
  circuitItinerary?: ItineraryStep[];
  tags?: string[];
  variations?: ServiceVariation[];
  unlimitedMode?: boolean;
  maxPeople?: number;
  cutoffTime?: number;
  status?: 'Active' | 'Draft' | 'Archived';
  images?: string[];
  featuredImage?: string;
}

interface AddServiceFormProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
  serviceToEdit?: Service;
}

const GLOBAL_CATEGORIES = ['Excursion', 'Wellness', 'Transfer', 'Amenity', 'F&B'];
const TAG_OPTIONS = ['Popular', 'Luxury', 'Family Friendly', 'Romantic', 'Adventure', 'Relaxation'];

export default function AddServiceForm({ propertyId, onClose, onSuccess, serviceToEdit }: AddServiceFormProps) {
  const isEditMode = !!serviceToEdit;
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [activeSection, setActiveSection] = useState<'classification' | 'content' | 'pricing' | 'logistics' | 'media'>('classification');
  
  const [formData, setFormData] = useState<ServiceFormData>({
    primaryCategory: serviceToEdit?.primaryCategory || serviceToEdit?.categoryId || '',
    subCategory: serviceToEdit?.subCategory || serviceToEdit?.subcategoryId || '',
    bookingEngine: serviceToEdit?.bookingEngine ?? true,
    guestPortal: serviceToEdit?.guestPortal ?? true,
    staffOnly: serviceToEdit?.staffOnly ?? false,
    displayName: serviceToEdit?.name || '',
    shortDescription: serviceToEdit?.description || '',
    longDescription: serviceToEdit?.longDescription || '',
    circuitItinerary: serviceToEdit?.circuitItinerary || [],
    tags: serviceToEdit?.tags || [],
    pricingMode: (serviceToEdit?.variations && serviceToEdit.variations.length > 0) ? 'variations' : 'base',
    basePrice: serviceToEdit?.price || 0,
    pricingType: serviceToEdit?.pricingType || 'one-time-per-guest',
    variations: serviceToEdit?.variations || [{ label: 'Standard', adultPrice: 0, childPrice: 0 }],
    unlimitedMode: serviceToEdit?.unlimitedMode ?? false,
    maxPeople: serviceToEdit?.maxPeople ?? 10,
    cutoffTime: serviceToEdit?.cutoffTime ?? 24,
    status: serviceToEdit?.status || 'Active',
    images: [],
    featuredImageIndex: 0,
  });
  
  const [imagePreviews, setImagePreviews] = useState<string[]>(serviceToEdit?.images || []);

  // Fetch categories from Firestore
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const catCol = collection(db, 'serviceCategories');
        const catQ = query(catCol, where('propertyId', '==', propertyId));
        const snapshot = await getDocs(catQ);
        const items: Category[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        
        const topLevel = items.filter(c => !c.parentId);
        setCategories(topLevel);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    if (propertyId) fetchCategories();
  }, [propertyId]);

  // Update subcategories when primary category changes
  useEffect(() => {
    const fetchSubCategories = async () => {
      if (!formData.primaryCategory) {
        setSubCategories([]);
        return;
      }
      
      try {
        const catCol = collection(db, 'serviceCategories');
        const catQ = query(catCol, where('propertyId', '==', propertyId), where('parentId', '==', formData.primaryCategory));
        const snapshot = await getDocs(catQ);
        const items: Category[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setSubCategories(items);
      } catch (error) {
        console.error('Error fetching subcategories:', error);
      }
    };
    
    fetchSubCategories();
  }, [formData.primaryCategory, propertyId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, images: [...prev.images, ...files] }));
    
    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      featuredImageIndex: prev.featuredImageIndex === index ? 0 : (prev.featuredImageIndex > index ? prev.featuredImageIndex - 1 : prev.featuredImageIndex)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const addVariation = () => {
    setFormData(prev => ({
      ...prev,
      variations: [...prev.variations, { label: '', adultPrice: 0, childPrice: 0 }]
    }));
  };

  const removeVariation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index)
    }));
  };

  const addItineraryStep = () => {
    setFormData(prev => ({
      ...prev,
      circuitItinerary: [...prev.circuitItinerary, { time: '', activity: '', location: '' }]
    }));
  };

  const removeItineraryStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      circuitItinerary: prev.circuitItinerary.filter((_, i) => i !== index)
    }));
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Upload new images to Firebase Storage (only if there are new files)
      const imageUrls: string[] = [...(serviceToEdit?.images || [])];
      
      if (formData.images.length > 0) {
        for (let i = 0; i < formData.images.length; i++) {
          const file = formData.images[i];
          const storageRef = ref(storage, `services/${propertyId}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
          setUploadProgress(((i + 1) / formData.images.length) * 100);
        }
      }

      // Create/Update service document
      const serviceData = {
        propertyId,
        name: formData.displayName,
        description: formData.shortDescription,
        longDescription: formData.longDescription,
        price: formData.pricingMode === 'base' ? formData.basePrice : (formData.variations[0]?.adultPrice || 0),
        currency: 'USD',
        pricingType: formData.pricingType,
        categoryId: formData.primaryCategory || null,
        subcategoryId: formData.subCategory || null,
        primaryCategory: formData.primaryCategory,
        subCategory: formData.subCategory,
        bookingEngine: formData.bookingEngine,
        guestPortal: formData.guestPortal,
        staffOnly: formData.staffOnly,
        circuitItinerary: formData.circuitItinerary,
        tags: formData.tags,
        variations: formData.pricingMode === 'variations' ? formData.variations : [],
        unlimitedMode: formData.unlimitedMode,
        maxPeople: formData.unlimitedMode ? null : formData.maxPeople,
        cutoffTime: formData.cutoffTime,
        status: formData.status,
        images: imageUrls,
        featuredImage: imageUrls[formData.featuredImageIndex] || imageUrls[0] || null,
        updatedAt: serverTimestamp(),
      };

      if (isEditMode && serviceToEdit) {
        // Update existing service
        await updateDoc(doc(db, 'services', serviceToEdit.id), serviceData);
      } else {
        // Create new service
        await addDoc(collection(db, 'services'), {
          ...serviceData,
          createdAt: serverTimestamp(),
        });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
      alert(`Failed to ${isEditMode ? 'update' : 'create'} service. Please try again.`);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const sections = [
    { id: 'classification', label: 'Classification', icon: Icons.Tag },
    { id: 'content', label: 'Content', icon: Icons.FileText },
    { id: 'pricing', label: 'Pricing', icon: Icons.DollarSign },
    { id: 'logistics', label: 'Logistics', icon: Icons.Clock },
    { id: 'media', label: 'Media', icon: Icons.ImageIcon },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icons.PlusCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Service' : 'Add New Service'}</h2>
                <p className="text-sm text-slate-500">{isEditMode ? 'Update service details' : 'Create a new service offering for your property'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              type="button"
            >
              <Icons.Close className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          {/* Section Navigation */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    activeSection === section.id
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6 space-y-6">
            
            {/* Classification Section */}
            {activeSection === 'classification' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Primary Category <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.primaryCategory}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryCategory: e.target.value, subCategory: '' }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Sub-Category
                    </label>
                    <select
                      value={formData.subCategory}
                      onChange={(e) => setFormData(prev => ({ ...prev, subCategory: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      disabled={!formData.primaryCategory || subCategories.length === 0}
                    >
                      <option value="">Select a sub-category</option>
                      {subCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {formData.primaryCategory && subCategories.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">No sub-categories available</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Channel Distribution</h4>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <Icons.Globe className="w-5 h-5 text-primary" />
                        <div>
                          <div className="font-medium text-slate-900">Booking Engine</div>
                          <div className="text-xs text-slate-500">Show during room booking flow</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.bookingEngine}
                        onChange={(e) => setFormData(prev => ({ ...prev, bookingEngine: e.target.checked }))}
                        className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    
                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <Icons.Smartphone className="w-5 h-5 text-primary" />
                        <div>
                          <div className="font-medium text-slate-900">Guest Portal</div>
                          <div className="text-xs text-slate-500">Available for in-house guests</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.guestPortal}
                        onChange={(e) => setFormData(prev => ({ ...prev, guestPortal: e.target.checked }))}
                        className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    
                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary transition-colors">
                      <div className="flex items-center gap-3">
                        <Icons.Lock className="w-5 h-5 text-primary" />
                        <div>
                          <div className="font-medium text-slate-900">Staff Only</div>
                          <div className="text-xs text-slate-500">Hidden from guests, front desk only</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.staffOnly}
                        onChange={(e) => setFormData(prev => ({ ...prev, staffOnly: e.target.checked }))}
                        className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Content Section */}
            {activeSection === 'content' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Display Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="e.g., Private Rooftop Dinner"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Short Description <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={formData.shortDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                    placeholder="A 1-2 sentence hook displayed on the service card"
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">{formData.shortDescription.length} characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Long Description
                  </label>
                  <textarea
                    value={formData.longDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, longDescription: e.target.value }))}
                    placeholder="Detailed info, inclusions, and what to bring for the modal view"
                    rows={5}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Tags / Badges
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          formData.tags.includes(tag)
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Circuit Itinerary (For Excursions)
                    </label>
                    <button
                      type="button"
                      onClick={addItineraryStep}
                      className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                      <Icons.PlusCircle className="w-4 h-4" />
                      Add Step
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.circuitItinerary.map((step, index) => (
                      <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500 uppercase">Step {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeItineraryStep(index)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Icons.Trash className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <input
                            type="time"
                            value={step.time || ''}
                            onChange={(e) => {
                              const newItinerary = [...formData.circuitItinerary];
                              newItinerary[index].time = e.target.value;
                              setFormData(prev => ({ ...prev, circuitItinerary: newItinerary }));
                            }}
                            placeholder="Time"
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                          <input
                            type="text"
                            value={step.activity || ''}
                            onChange={(e) => {
                              const newItinerary = [...formData.circuitItinerary];
                              newItinerary[index].activity = e.target.value;
                              setFormData(prev => ({ ...prev, circuitItinerary: newItinerary }));
                            }}
                            placeholder="Activity"
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                          <input
                            type="text"
                            value={step.location || ''}
                            onChange={(e) => {
                              const newItinerary = [...formData.circuitItinerary];
                              newItinerary[index].location = e.target.value;
                              setFormData(prev => ({ ...prev, circuitItinerary: newItinerary }));
                            }}
                            placeholder="Location"
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        </div>
                      </div>
                    ))}
                    {formData.circuitItinerary.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">No itinerary steps added</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Section */}
            {activeSection === 'pricing' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Pricing Mode Toggle */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Pricing Structure</h3>
                  <p className="text-sm text-slate-500 mb-4">Choose between a fixed base price or variable pricing tiers</p>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, pricingMode: 'base' }))}
                      className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                        formData.pricingMode === 'base'
                          ? 'border-primary bg-primary/5 text-primary font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Icons.DollarSign className="w-5 h-5" />
                        <span>Base Price</span>
                      </div>
                      <p className="text-xs mt-1 opacity-70">Single fixed price</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, pricingMode: 'variations' }))}
                      className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
                        formData.pricingMode === 'variations'
                          ? 'border-primary bg-primary/5 text-primary font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Icons.Tag className="w-5 h-5" />
                        <span>Price Variations</span>
                      </div>
                      <p className="text-xs mt-1 opacity-70">Multiple pricing tiers</p>
                    </button>
                  </div>
                </div>

                {/* Base Price Section */}
                {formData.pricingMode === 'base' && (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Base Price</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
                        <input
                          type="number"
                          value={formData.basePrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Pricing Type</label>
                      <select
                        value={formData.pricingType}
                        onChange={(e) => setFormData(prev => ({ ...prev, pricingType: e.target.value as any }))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="one-time-per-guest">One-time / Per Guest</option>
                        <option value="per-guest-per-night">Per Guest / Per Night</option>
                        <option value="per-reservation">Per Reservation</option>
                        <option value="per-night">Per Night</option>
                        <option value="per-guest">Per Guest</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Price Variations Section */}
                {formData.pricingMode === 'variations' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-md font-bold text-slate-900">Pricing Tiers</h4>
                        <p className="text-sm text-slate-500">Define different pricing options for your service</p>
                      </div>
                      <button
                        type="button"
                        onClick={addVariation}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                      >
                        <Icons.PlusCircle className="w-4 h-4" />
                        Add Tier
                      </button>
                    </div>

                    {/* Pricing Type Selector */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Pricing Type</label>
                      <select
                        value={formData.pricingType}
                        onChange={(e) => setFormData(prev => ({ ...prev, pricingType: e.target.value as any }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="one-time-per-guest">One-time / Per Guest</option>
                        <option value="per-guest-per-night">Per Guest / Per Night</option>
                        <option value="per-reservation">Per Reservation</option>
                        <option value="per-night">Per Night</option>
                        <option value="per-guest">Per Guest</option>
                      </select>
                    </div>

                    {/* Variation Cards */}
                    <div className="space-y-4">
                      {formData.variations.map((variation, index) => (
                        <div key={index} className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between mb-4">
                            <input
                              type="text"
                              value={variation.label || ''}
                              onChange={(e) => {
                                const newVariations = [...formData.variations];
                                newVariations[index].label = e.target.value;
                                setFormData(prev => ({ ...prev, variations: newVariations }));
                              }}
                              placeholder="Tier Label (e.g., Standard, VIP, Private)"
                              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            {formData.variations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeVariation(index)}
                                className="ml-3 p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Icons.Trash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Adult Price</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                  type="number"
                                  value={variation.adultPrice ?? 0}
                                  onChange={(e) => {
                                    const newVariations = [...formData.variations];
                                    newVariations[index].adultPrice = parseFloat(e.target.value) || 0;
                                    setFormData(prev => ({ ...prev, variations: newVariations }));
                                  }}
                                  className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Child Price</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                  type="number"
                                  value={variation.childPrice ?? 0}
                                  onChange={(e) => {
                                    const newVariations = [...formData.variations];
                                    newVariations[index].childPrice = parseFloat(e.target.value) || 0;
                                    setFormData(prev => ({ ...prev, variations: newVariations }));
                                  }}
                                  className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Logistics Section */}
            {activeSection === 'logistics' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div>
                  <label className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={formData.unlimitedMode}
                      onChange={(e) => setFormData(prev => ({ ...prev, unlimitedMode: e.target.checked }))}
                      className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">Unlimited People per Booking</div>
                      <div className="text-xs text-slate-500">No maximum limit on people per reservation</div>
                    </div>
                  </label>
                  
                  {!formData.unlimitedMode && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Maximum People per Booking
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={formData.maxPeople}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxPeople: parseInt(e.target.value) }))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <input
                          type="number"
                          value={formData.maxPeople}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxPeople: parseInt(e.target.value) || 1 }))}
                          className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                          min="1"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Maximum {formData.maxPeople} people allowed per reservation</p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Booking Cut-off Time
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formData.cutoffTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, cutoffTime: parseInt(e.target.value) || 0 }))}
                      className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                      min="0"
                    />
                    <span className="text-sm text-slate-600">hours before service</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Minimum lead time required for booking</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Service Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Active', 'Draft', 'Archived'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status }))}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          formData.status === status
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Media Section */}
            {activeSection === 'media' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Service Gallery
                  </label>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-200">
                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, featuredImageIndex: index }))}
                            className={`p-2 rounded-lg ${formData.featuredImageIndex === index ? 'bg-primary text-white' : 'bg-white text-slate-700'}`}
                          >
                            <Icons.Star className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="p-2 bg-destructive text-white rounded-lg"
                          >
                            <Icons.Trash className="w-4 h-4" />
                          </button>
                        </div>
                        {formData.featuredImageIndex === index && (
                          <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
                            Featured
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-primary transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100">
                      <Icons.UploadCloud className="w-8 h-8 text-slate-400" />
                      <span className="text-xs font-medium text-slate-500">Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  {imagePreviews.length === 0 && (
                    <p className="text-sm text-slate-400 text-center mt-4">No images uploaded yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {activeSection === 'classification' && 'Step 1 of 5'}
            {activeSection === 'content' && 'Step 2 of 5'}
            {activeSection === 'pricing' && 'Step 3 of 5'}
            {activeSection === 'logistics' && 'Step 4 of 5'}
            {activeSection === 'media' && 'Step 5 of 5'}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.displayName || !formData.primaryCategory}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Icons.Spinner className="w-4 h-4 animate-spin" />
                  {uploadProgress > 0 ? `Uploading ${uploadProgress.toFixed(0)}%` : isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Icons.CheckCircle2 className="w-4 h-4" />
                  {isEditMode ? 'Update Service' : 'Create Service'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
