"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '@/components/icons';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';

interface MenuSectionItem {
  id: string;
  name: string;
  description?: string;
  dietaryTags: string[]; // Vegetarian, Vegan, Halal, Gluten-Free
  allergens?: string[];
}

interface MenuSection {
  id: string;
  title: string;
  order: number;
  collapsed?: boolean;
  items: MenuSectionItem[];
}

interface MenuFormData {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'ftour' | 'snacks' | 'custom';
  shortDescription?: string;
  language?: string;
  linkedMealPlanIds: string[];
  defaultForMealPlans: boolean; // toggle
  sections: MenuSection[];
  availableDays: 'daily' | string[];
  validDates: { start: string; end: string } | null;
  seasonal: boolean;
  visibleInGuestPortal: boolean;
  visibleOnBooking: boolean;
  status: 'Draft' | 'Active';
}

interface AddMenuFormProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  mealPlans: { id: string; name: string; mealPlanType?: string }[];
  menuToEdit?: any;
}

const STEPS = ['Menu Basics', 'Link Meal Plans', 'Menu Content', 'Availability', 'Visibility'];

export default function AddMenuForm({ isOpen, onClose, propertyId, mealPlans, menuToEdit }: AddMenuFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<MenuFormData>({
    name: '',
    mealType: 'breakfast',
    shortDescription: '',
    language: '',
    linkedMealPlanIds: [],
    defaultForMealPlans: false,
    sections: [],
    availableDays: 'daily',
    validDates: null,
    seasonal: false,
    visibleInGuestPortal: true,
    visibleOnBooking: false,
    status: 'Draft',
  });

  useEffect(() => {
    if (menuToEdit) {
      setFormData({
        name: menuToEdit.name || '',
        mealType: (menuToEdit.mealType || 'breakfast'),
        shortDescription: menuToEdit.shortDescription || '',
        language: menuToEdit.language || '',
        linkedMealPlanIds: menuToEdit.linkedMealPlanIds || [],
        defaultForMealPlans: !!menuToEdit.defaultForMealPlans,
        sections: menuToEdit.sections || [],
        availableDays: menuToEdit.availableDays || 'daily',
        validDates: menuToEdit.validDates || null,
        seasonal: !!menuToEdit.seasonal,
        visibleInGuestPortal: menuToEdit.visibleInGuestPortal ?? true,
        visibleOnBooking: menuToEdit.visibleOnBooking ?? false,
        status: menuToEdit.status || 'Draft',
      });
    }
  }, [menuToEdit]);

  const updateField = <K extends keyof MenuFormData>(field: K, value: MenuFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSection = () => {
    const newSection: MenuSection = {
      id: Math.random().toString(36).slice(2),
      title: 'New Section',
      order: (formData.sections[formData.sections.length - 1]?.order ?? 0) + 1,
      collapsed: false,
      items: [],
    };
    updateField('sections', [...formData.sections, newSection]);
  };

  const addItem = (sectionId: string) => {
    updateField('sections', formData.sections.map(sec => {
      if (sec.id !== sectionId) return sec;
      const newItem: MenuSectionItem = {
        id: Math.random().toString(36).slice(2),
        name: 'New Item',
        description: '',
        dietaryTags: [],
        allergens: [],
      };
      return { ...sec, items: [...sec.items, newItem] };
    }));
  };

  const removeSection = (sectionId: string) => {
    updateField('sections', formData.sections.filter(s => s.id !== sectionId));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    updateField('sections', formData.sections.map(sec => sec.id === sectionId ? ({ ...sec, items: sec.items.filter(i => i.id !== itemId) }) : sec));
  };

  // Drag & Drop ordering
  const [dragging, setDragging] = useState<{ type: 'section' | 'item'; sectionId?: string; id: string } | null>(null);

  const onDragStartSection = (sectionId: string) => setDragging({ type: 'section', id: sectionId });
  const onDragOverSection = (overSectionId: string) => {
    if (!dragging || dragging.type !== 'section' || dragging.id === overSectionId) return;
    const ordered = [...formData.sections];
    const fromIdx = ordered.findIndex(s => s.id === dragging.id);
    const toIdx = ordered.findIndex(s => s.id === overSectionId);
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    ordered.forEach((s, idx) => s.order = idx + 1);
    updateField('sections', ordered);
  };
  const onDragEnd = () => setDragging(null);

  const onDragStartItem = (sectionId: string, itemId: string) => setDragging({ type: 'item', sectionId, id: itemId });
  const onDragOverItem = (sectionId: string, overItemId: string) => {
    if (!dragging || dragging.type !== 'item' || dragging.sectionId !== sectionId || dragging.id === overItemId) return;
    const sec = formData.sections.find(s => s.id === sectionId);
    if (!sec) return;
    const items = [...sec.items];
    const fromIdx = items.findIndex(i => i.id === dragging.id);
    const toIdx = items.findIndex(i => i.id === overItemId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    updateField('sections', formData.sections.map(s => s.id === sectionId ? ({ ...s, items }) : s));
  };

  const handleSubmit = async (asDraft = false) => {
    if (!propertyId) return;
    setSaving(true);
    try {
      const data = {
        ...formData,
        status: asDraft ? 'Draft' : formData.status,
        propertyId,
        updatedAt: serverTimestamp(),
      };
      if (menuToEdit?.id) {
        await updateDoc(doc(db, 'menus', menuToEdit.id), data);
      } else {
        await addDoc(collection(db, 'menus'), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      console.error('Save menu error:', err);
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
            <h2 className="text-2xl font-bold">{menuToEdit ? 'Edit Menu' : 'Add New Menu'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>
          {/* Steps */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    idx === currentStep ? 'bg-white text-primary scale-110' : idx < currentStep ? 'bg-white/80 text-primary' : 'bg-white/20 text-white/60'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className={`text-xs mt-1 font-medium transition-opacity ${idx === currentStep ? 'opacity-100' : 'opacity-60'}`}>{step}</div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 transition-all ${idx < currentStep ? 'bg-white/80' : 'bg-white/20'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)]">
          {/* Preview overlay */}
          {showPreview && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900">Menu Preview</h3>
                  <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg"><Icons.X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{formData.name || 'Untitled Menu'}</h2>
                    {formData.shortDescription && (<p className="text-slate-600 mt-1">{formData.shortDescription}</p>)}
                    <div className="mt-2 text-xs text-slate-500">Meal Type: {formData.mealType}</div>
                  </div>
                  {formData.sections.map(sec => (
                    <div key={sec.id}>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">{sec.title}</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {sec.items.map(item => (
                          <div key={item.id} className="p-3 border border-slate-200 rounded-xl">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            {item.description && (<div className="text-sm text-slate-600">{item.description}</div>)}
                            {(item.dietaryTags.length > 0 || (item.allergens && item.allergens.length > 0)) && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.dietaryTags.map(tag => (
                                  <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">{tag}</span>
                                ))}
                                {(item.allergens || []).map(al => (
                                  <span key={al} className="px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700 border border-red-200">{al}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Step 1: Basics */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Menu Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Meal Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {['breakfast','lunch','dinner','ftour','snacks','custom'].map(mt => (
                    <button key={mt} onClick={() => updateField('mealType', mt as any)} className={`p-4 border-2 rounded-xl font-medium transition-all ${formData.mealType === mt ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>{mt[0].toUpperCase()+mt.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Short Description</label>
                <textarea value={formData.shortDescription} onChange={(e) => updateField('shortDescription', e.target.value)} rows={2} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Language (optional)</label>
                <input type="text" value={formData.language} onChange={(e) => updateField('language', e.target.value)} placeholder="e.g., en-US" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
          )}

          {/* Step 2: Link to Meal Plans */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Link to Meal Plans</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {mealPlans.map(mp => (
                    <label key={mp.id} className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.linkedMealPlanIds.includes(mp.id) ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={formData.linkedMealPlanIds.includes(mp.id)} onChange={() => updateField('linkedMealPlanIds', formData.linkedMealPlanIds.includes(mp.id) ? formData.linkedMealPlanIds.filter(id => id !== mp.id) : [...formData.linkedMealPlanIds, mp.id])} className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                      <span className="font-medium text-slate-700">{mp.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <input type="checkbox" checked={formData.defaultForMealPlans} onChange={(e) => updateField('defaultForMealPlans', e.target.checked)} className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                <label className="font-medium text-slate-700">Set as Default Menu for selected Meal Plan(s)</label>
              </div>
              <p className="text-sm text-slate-500">Only one default menu per meal type will be used per meal plan.</p>
            </div>
          )}

          {/* Step 3: Menu Content */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Menu Sections</h3>
                <button onClick={addSection} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"><Icons.PlusCircle className="w-4 h-4" /> Add Section</button>
              </div>
              <div className="space-y-4">
                {formData.sections.length === 0 && (
                  <div className="text-sm text-slate-500">No sections yet. Add your first section.</div>
                )}
                {formData.sections.map(section => (
                  <div key={section.id} draggable onDragStart={() => onDragStartSection(section.id)} onDragOver={() => onDragOverSection(section.id)} onDragEnd={onDragEnd} className="border-2 border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icons.GripVertical className="w-4 h-4 text-slate-400" />
                        <input type="text" value={section.title} onChange={(e) => updateField('sections', formData.sections.map(s => s.id === section.id ? ({ ...s, title: e.target.value }) : s))} className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateField('sections', formData.sections.map(s => s.id === section.id ? ({ ...s, collapsed: !s.collapsed }) : s))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Collapse/Expand">
                          <Icons.ChevronDown className={`w-4 h-4 text-slate-600 ${section.collapsed ? '' : 'rotate-180'}`} />
                        </button>
                        <button onClick={() => removeSection(section.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Remove section">
                          <Icons.Trash className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                    {!section.collapsed && (
                      <div className="mt-4 space-y-3">
                        {section.items.map(item => (
                          <div key={item.id} draggable onDragStart={() => onDragStartItem(section.id, item.id)} onDragOver={() => onDragOverItem(section.id, item.id)} onDragEnd={onDragEnd} className="p-3 border border-slate-200 rounded-xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Item Name</label>
                                <input type="text" value={item.name} onChange={(e) => updateField('sections', formData.sections.map(s => s.id === section.id ? ({ ...s, items: s.items.map(i => i.id === item.id ? ({ ...i, name: e.target.value }) : i) }) : s))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Short Description</label>
                                <input type="text" value={item.description || ''} onChange={(e) => updateField('sections', formData.sections.map(s => s.id === section.id ? ({ ...s, items: s.items.map(i => i.id === item.id ? ({ ...i, description: e.target.value }) : i) }) : s))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Dietary Tags</label>
                                <div className="flex flex-wrap gap-2">
                                  {['Vegetarian','Vegan','Halal','Gluten-Free'].map(tag => (
                                    <label key={tag} className="flex items-center gap-2 px-3 py-1 border rounded-full text-xs cursor-pointer">
                                      <input type="checkbox" checked={item.dietaryTags.includes(tag)} onChange={() => updateField('sections', formData.sections.map(s => s.id === section.id ? ({ ...s, items: s.items.map(i => i.id === item.id ? ({ ...i, dietaryTags: i.dietaryTags.includes(tag) ? i.dietaryTags.filter(t => t !== tag) : [...i.dietaryTags, tag] }) : i) }) : s))} className="w-3 h-3" />
                                      <span>{tag}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Allergens (optional)</label>
                                <input type="text" placeholder="e.g., Nuts, Dairy" value={(item.allergens || []).join(', ')} onChange={(e) => updateField('sections', formData.sections.map(s => s.id === section.id ? ({ ...s, items: s.items.map(i => i.id === item.id ? ({ ...i, allergens: e.target.value.split(',').map(a => a.trim()).filter(Boolean) }) : i) }) : s))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-end">
                              <button onClick={() => removeItem(section.id, item.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100">Remove Item</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => addItem(section.id)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"><Icons.PlusCircle className="w-4 h-4" /> Add Item</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Availability & Rules */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Available Days</label>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <input type="checkbox" checked={formData.availableDays === 'daily'} onChange={(e) => updateField('availableDays', e.target.checked ? 'daily' : [])} className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                  <span className="font-medium text-slate-700">Daily</span>
                </div>
                {formData.availableDays !== 'daily' && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                      <label key={day} className={`flex items-center gap-3 p-2 border rounded-xl cursor-pointer ${Array.isArray(formData.availableDays) && formData.availableDays.includes(day) ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input type="checkbox" checked={Array.isArray(formData.availableDays) && formData.availableDays.includes(day)} onChange={() => {
                          if (!Array.isArray(formData.availableDays)) updateField('availableDays', []);
                          const days = Array.isArray(formData.availableDays) ? [...formData.availableDays] : [];
                          const exists = days.includes(day);
                          updateField('availableDays', exists ? days.filter(d => d !== day) : [...days, day]);
                        }} className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                        <span className="text-sm text-slate-700">{day}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Valid Dates</label>
                <label className="flex items-center gap-3 mb-3">
                  <input type="checkbox" checked={formData.validDates !== null} onChange={(e) => updateField('validDates', e.target.checked ? { start: '', end: '' } : null)} className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                  <span className="text-sm text-slate-700">Enable date limits for this menu</span>
                </label>
                {formData.validDates !== null ? (
                  <div className="flex gap-3 items-center">
                    <input type="date" value={formData.validDates?.start || ''} onChange={(e) => updateField('validDates', { start: e.target.value, end: formData.validDates?.end ?? '' })} className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <span className="text-sm text-slate-500">to</span>
                    <input type="date" value={formData.validDates?.end || ''} onChange={(e) => updateField('validDates', { start: formData.validDates?.start || '', end: e.target.value })} className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No date limits — this menu is always valid.</p>
                )}
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <input type="checkbox" checked={formData.seasonal} onChange={(e) => updateField('seasonal', e.target.checked)} className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                <label className="font-medium text-slate-700">Seasonal Menu</label>
              </div>
            </div>
          )}

          {/* Step 5: Visibility */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <input type="checkbox" checked={formData.visibleInGuestPortal} onChange={(e) => updateField('visibleInGuestPortal', e.target.checked)} className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                <label className="font-medium text-slate-700">Visible in Guest Portal</label>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input type="checkbox" checked={formData.visibleOnBooking} onChange={(e) => updateField('visibleOnBooking', e.target.checked)} className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary/20" />
                <label className="font-medium text-slate-700">Visible During Booking (OFF by default)</label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Draft','Active'].map(status => (
                    <button key={status} onClick={() => updateField('status', status as any)} className={`p-4 border-2 rounded-xl font-medium transition-all ${formData.status === status ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>{status}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Back</button>
              <button onClick={() => setShowPreview(true)} className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-white transition-colors">Preview</button>
            </div>
            <div className="flex items-center gap-3">
              {currentStep === STEPS.length - 1 && (
                <button onClick={() => handleSubmit(true)} disabled={saving} className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-white transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Draft'}</button>
              )}
              {currentStep < STEPS.length - 1 ? (
                <button onClick={() => setCurrentStep(currentStep + 1)} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">Next <Icons.ChevronRight className="w-5 h-5" /></button>
              ) : (
                <button onClick={() => handleSubmit(false)} disabled={saving} className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">{saving ? (<><Icons.Spinner className="w-5 h-5 animate-spin" /> Saving...</>) : (<><Icons.CheckCircle2 className="w-5 h-5" /> {menuToEdit ? 'Update' : 'Publish'}</>)}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
