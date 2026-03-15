"use client";

import React, { useState, useEffect } from 'react';
import { Icons } from '@/components/icons';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { Menu, MenuSection, MenuItem, MealType, DietaryTag } from '@/types/menu';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface AddMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  mealPlans: { id: string; name: string }[];
  menuToEdit?: Menu | null;
}

const STEPS = [
  'Menu Basics',
  'Link to Meal Plans',
  'Menu Content',
  'Availability & Rules',
  'Visibility & Status'
];

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'ftour', label: 'Ftour' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'custom', label: 'Custom' },
];

const DIETARY_TAGS: { value: DietaryTag; label: string; icon: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'halal', label: 'Halal', icon: '☪️' },
  { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { value: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  { value: 'nut-free', label: 'Nut-Free', icon: '🥜' },
];

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export default function AddMenuModal({ isOpen, onClose, propertyId, mealPlans, menuToEdit }: AddMenuModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    mealType: 'breakfast' as MealType,
    shortDescription: '',
    language: 'en',
    linkedMealPlans: [] as string[],
    defaultForMealPlans: [] as string[],
    sections: [] as MenuSection[],
    availableDays: [] as string[],
    validDateRange: null as { start: string; end: string } | null,
    isSeasonal: false,
    visibleInGuestPortal: true,
    visibleDuringBooking: false,
    status: 'draft' as 'draft' | 'active',
  });

  useEffect(() => {
    if (menuToEdit) {
      setFormData({
        name: menuToEdit.name || '',
        mealType: menuToEdit.mealType || 'breakfast',
        shortDescription: menuToEdit.shortDescription || '',
        language: menuToEdit.language || 'en',
        linkedMealPlans: menuToEdit.linkedMealPlans || [],
        defaultForMealPlans: menuToEdit.defaultForMealPlans || [],
        sections: menuToEdit.sections || [],
        availableDays: menuToEdit.availableDays || [],
        validDateRange: menuToEdit.validDateRange || null,
        isSeasonal: menuToEdit.isSeasonal || false,
        visibleInGuestPortal: menuToEdit.visibleInGuestPortal ?? true,
        visibleDuringBooking: menuToEdit.visibleDuringBooking || false,
        status: menuToEdit.status || 'draft',
      });
    }
  }, [menuToEdit]);

  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSection = () => {
    const newSection: MenuSection = {
      id: `section-${Date.now()}`,
      title: '',
      displayOrder: formData.sections.length,
      items: [],
    };
    updateField('sections', [...formData.sections, newSection]);
  };

  const updateSection = (sectionId: string, updates: Partial<MenuSection>) => {
    updateField('sections', formData.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
  };

  const removeSection = (sectionId: string) => {
    updateField('sections', formData.sections.filter(s => s.id !== sectionId));
  };

  const addItem = (sectionId: string) => {
    const section = formData.sections.find(s => s.id === sectionId);
    if (!section) return;

    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      name: '',
      description: '',
      dietaryTags: [],
      allergens: [],
      displayOrder: section.items.length,
    };

    updateSection(sectionId, { items: [...section.items, newItem] });
  };

  const updateItem = (sectionId: string, itemId: string, updates: Partial<MenuItem>) => {
    const section = formData.sections.find(s => s.id === sectionId);
    if (!section) return;

    updateSection(sectionId, {
      items: section.items.map(item => item.id === itemId ? { ...item, ...updates } : item)
    });
  };

  const removeItem = (sectionId: string, itemId: string) => {
    const section = formData.sections.find(s => s.id === sectionId);
    if (!section) return;

    updateSection(sectionId, {
      items: section.items.filter(item => item.id !== itemId)
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (result.type === 'section') {
      const newSections = Array.from(formData.sections);
      const [removed] = newSections.splice(sourceIndex, 1);
      newSections.splice(destIndex, 0, removed);
      updateField('sections', newSections.map((s, idx) => ({ ...s, displayOrder: idx })));
    } else {
      const sectionId = result.type;
      const section = formData.sections.find(s => s.id === sectionId);
      if (!section) return;

      const newItems = Array.from(section.items);
      const [removed] = newItems.splice(sourceIndex, 1);
      newItems.splice(destIndex, 0, removed);
      updateSection(sectionId, { items: newItems.map((item, idx) => ({ ...item, displayOrder: idx })) });
    }
  };

  const toggleDay = (day: string) => {
    if (formData.availableDays.includes(day)) {
      updateField('availableDays', formData.availableDays.filter(d => d !== day));
    } else {
      updateField('availableDays', [...formData.availableDays, day]);
    }
  };

  const toggleMealPlan = (mealPlanId: string) => {
    if (formData.linkedMealPlans.includes(mealPlanId)) {
      updateField('linkedMealPlans', formData.linkedMealPlans.filter(id => id !== mealPlanId));
      updateField('defaultForMealPlans', formData.defaultForMealPlans.filter(id => id !== mealPlanId));
    } else {
      updateField('linkedMealPlans', [...formData.linkedMealPlans, mealPlanId]);
    }
  };

  const toggleDefaultForMealPlan = (mealPlanId: string) => {
    if (!formData.linkedMealPlans.includes(mealPlanId)) return;

    if (formData.defaultForMealPlans.includes(mealPlanId)) {
      updateField('defaultForMealPlans', formData.defaultForMealPlans.filter(id => id !== mealPlanId));
    } else {
      updateField('defaultForMealPlans', [...formData.defaultForMealPlans, mealPlanId]);
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0:
        return formData.name.trim() && formData.mealType;
      case 1:
        return formData.linkedMealPlans.length > 0;
      case 2:
        return formData.sections.length > 0 && formData.sections.every(s => s.title.trim());
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

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const menuData: any = {
        name: formData.name.trim(),
        mealType: formData.mealType,
        shortDescription: formData.shortDescription.trim(),
        language: formData.language,
        linkedMealPlans: formData.linkedMealPlans,
        defaultForMealPlans: formData.defaultForMealPlans,
        sections: formData.sections,
        availableDays: formData.availableDays,
        validDateRange: formData.validDateRange,
        isSeasonal: formData.isSeasonal,
        visibleInGuestPortal: formData.visibleInGuestPortal,
        visibleDuringBooking: formData.visibleDuringBooking,
        status: formData.status,
        propertyId,
        updatedAt: serverTimestamp(),
      };

      if (menuToEdit) {
        await updateDoc(doc(db, 'menus', menuToEdit.id), menuData);
      } else {
        await addDoc(collection(db, 'menus'), {
          ...menuData,
          createdAt: serverTimestamp(),
          createdBy: 'user-id', // TODO: get from auth
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving menu:', err);
      alert('Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {menuToEdit ? 'Edit Menu' : 'Add New Menu'}
            </h2>
            <div className="flex items-center gap-2">
              {currentStep === 2 && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-medium"
                >
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
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
          {/* Step 1: Menu Basics */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Menu Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Traditional Moroccan Breakfast"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Meal Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {MEAL_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => updateField('mealType', type.value)}
                      className={`p-4 border-2 rounded-xl font-medium transition-all ${
                        formData.mealType === type.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Short Description (optional)
                </label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) => updateField('shortDescription', e.target.value)}
                  placeholder="Brief description of this menu..."
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Language (optional)
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => updateField('language', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Link to Meal Plans */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Link Menu to Meal Plans <span className="text-red-500">*</span>
                </label>
                {mealPlans.length > 0 ? (
                  <div className="space-y-3">
                    {mealPlans.map(mp => (
                      <div key={mp.id} className="p-4 border-2 border-slate-200 rounded-xl">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.linkedMealPlans.includes(mp.id)}
                            onChange={() => toggleMealPlan(mp.id)}
                            className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900">{mp.name}</div>
                          </div>
                        </label>

                        {formData.linkedMealPlans.includes(mp.id) && (
                          <div className="mt-3 ml-8">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.defaultForMealPlans.includes(mp.id)}
                                onChange={() => toggleDefaultForMealPlan(mp.id)}
                                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                              />
                              <span className="text-slate-700">Set as default menu for this meal plan</span>
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <Icons.AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600">No meal plans available. Create a meal plan first.</p>
                  </div>
                )}
              </div>

              {formData.linkedMealPlans.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Icons.AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <strong>Note:</strong> Only one menu can be set as default per meal type for each meal plan.
                      If you set this menu as default, it will override any existing default menu for the same meal type.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Menu Content */}
          {currentStep === 2 && !showPreview && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Menu Sections & Items</h3>
                  <button
                    onClick={addSection}
                    className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    <Icons.PlusCircle className="w-4 h-4" />
                    Add Section
                  </button>
                </div>

                <Droppable droppableId="sections" type="section">
                  {(provided: any) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                      {formData.sections.map((section, sectionIdx) => (
                        <Draggable key={section.id} draggableId={section.id} index={sectionIdx}>
                          {(provided: any) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200"
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <Icons.Grip className="w-5 h-5 text-slate-400" />
                                </div>
                                <input
                                  type="text"
                                  value={section.title}
                                  onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                  placeholder="Section title (e.g., Starters, Main Dishes)"
                                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button
                                  onClick={() => addItem(section.id)}
                                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                  <Icons.PlusCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeSection(section.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                  <Icons.Trash className="w-4 h-4" />
                                </button>
                              </div>

                              <Droppable droppableId={`items-${section.id}`} type={section.id}>
                                {(provided: any) => (
                                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 ml-8">
                                    {section.items.map((item, itemIdx) => (
                                      <Draggable key={item.id} draggableId={item.id} index={itemIdx}>
                                        {(provided: any) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className="p-3 bg-white rounded-xl border border-slate-200"
                                          >
                                            <div className="flex items-start gap-3">
                                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing mt-2">
                                                <Icons.Grip className="w-4 h-4 text-slate-400" />
                                              </div>
                                              <div className="flex-1 space-y-3">
                                                <input
                                                  type="text"
                                                  value={item.name}
                                                  onChange={(e) => updateItem(section.id, item.id, { name: e.target.value })}
                                                  placeholder="Item name"
                                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                                                />
                                                <textarea
                                                  value={item.description}
                                                  onChange={(e) => updateItem(section.id, item.id, { description: e.target.value })}
                                                  placeholder="Short description (optional)"
                                                  rows={2}
                                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                  {DIETARY_TAGS.map(tag => (
                                                    <button
                                                      key={tag.value}
                                                      onClick={() => {
                                                        const tags = item.dietaryTags || [];
                                                        const newTags = tags.includes(tag.value)
                                                          ? tags.filter(t => t !== tag.value)
                                                          : [...tags, tag.value];
                                                        updateItem(section.id, item.id, { dietaryTags: newTags });
                                                      }}
                                                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                                        item.dietaryTags?.includes(tag.value)
                                                          ? 'bg-green-100 text-green-700 border-2 border-green-300'
                                                          : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:border-slate-300'
                                                      }`}
                                                    >
                                                      {tag.icon} {tag.label}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                              <button
                                                onClick={() => removeItem(section.id, item.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                              >
                                                <Icons.X className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                    {section.items.length === 0 && (
                                      <div className="text-center py-4 text-sm text-slate-500">
                                        No items yet. Click + to add items to this section.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {formData.sections.length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                    <Icons.Menu className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 mb-4">No sections yet. Start building your menu!</p>
                    <button
                      onClick={addSection}
                      className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                    >
                      <Icons.PlusCircle className="w-4 h-4" />
                      Add First Section
                    </button>
                  </div>
                )}
              </div>
            </DragDropContext>
          )}

          {/* Step 3: Preview Mode */}
          {currentStep === 2 && showPreview && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-8 border-2 border-slate-200 shadow-lg">
                <div className="text-center mb-6">
                  <h3 className="text-3xl font-bold text-slate-900 mb-2">{formData.name}</h3>
                  <p className="text-slate-600">{formData.shortDescription}</p>
                  <div className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mt-3">
                    {MEAL_TYPES.find(t => t.value === formData.mealType)?.label}
                  </div>
                </div>

                <div className="space-y-6">
                  {formData.sections.map(section => (
                    <div key={section.id}>
                      <h4 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                        {section.title}
                      </h4>
                      <div className="space-y-4">
                        {section.items.map(item => (
                          <div key={item.id} className="pl-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="font-semibold text-slate-900">{item.name}</div>
                                {item.description && (
                                  <div className="text-sm text-slate-600 mt-1">{item.description}</div>
                                )}
                                {item.dietaryTags && item.dietaryTags.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {item.dietaryTags.map(tag => {
                                      const tagInfo = DIETARY_TAGS.find(t => t.value === tag);
                                      return (
                                        <span key={tag} className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                                          {tagInfo?.icon} {tagInfo?.label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Availability & Rules */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Available Days
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`p-3 border-2 rounded-xl font-medium transition-all ${
                        formData.availableDays.includes(day.value)
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {formData.availableDays.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">No days selected = available daily</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={formData.validDateRange !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateField('validDateRange', { start: '', end: '' });
                      } else {
                        updateField('validDateRange', null);
                      }
                    }}
                    className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm font-semibold text-slate-700">Set valid date range</span>
                </label>

                {formData.validDateRange && (
                  <div className="flex gap-3 items-center pl-7">
                    <input
                      type="date"
                      value={formData.validDateRange.start}
                      onChange={(e) => updateField('validDateRange', { ...formData.validDateRange!, start: e.target.value })}
                      className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-sm text-slate-500">to</span>
                    <input
                      type="date"
                      value={formData.validDateRange.end}
                      onChange={(e) => updateField('validDateRange', { ...formData.validDateRange!, end: e.target.value })}
                      className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isSeasonal}
                    onChange={(e) => updateField('isSeasonal', e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Seasonal Menu</div>
                    <div className="text-sm text-slate-600">Mark this menu as seasonal (e.g., Ramadan, Summer)</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Visibility & Status */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-primary/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.visibleInGuestPortal}
                    onChange={(e) => updateField('visibleInGuestPortal', e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Visible in Guest Portal</div>
                    <div className="text-sm text-slate-500">Guests can view this menu in their portal</div>
                  </div>
                  <Icons.Eye className="w-5 h-5 text-slate-400" />
                </label>

                <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-primary/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.visibleDuringBooking}
                    onChange={(e) => updateField('visibleDuringBooking', e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Visible During Booking</div>
                    <div className="text-sm text-slate-500">Show this menu during the booking process</div>
                  </div>
                  <Icons.ShoppingBag className="w-5 h-5 text-slate-400" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Publication Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['draft', 'active'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateField('status', status as 'draft' | 'active')}
                      className={`p-4 border-2 rounded-xl font-medium transition-all capitalize ${
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

              <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                <h4 className="font-semibold text-slate-900 mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Menu Name:</span>
                    <span className="font-medium text-slate-900">{formData.name || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Meal Type:</span>
                    <span className="font-medium text-slate-900">{MEAL_TYPES.find(t => t.value === formData.mealType)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Linked Meal Plans:</span>
                    <span className="font-medium text-slate-900">{formData.linkedMealPlans.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sections:</span>
                    <span className="font-medium text-slate-900">{formData.sections.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Items:</span>
                    <span className="font-medium text-slate-900">
                      {formData.sections.reduce((sum, s) => sum + s.items.length, 0)}
                    </span>
                  </div>
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
                  onClick={handleSubmit}
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
                      {menuToEdit ? 'Update Menu' : 'Create Menu'}
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
