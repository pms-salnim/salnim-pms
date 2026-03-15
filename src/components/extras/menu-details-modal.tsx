"use client";

import React from 'react';
import { Icons } from '@/components/icons';
import type { Menu, DietaryTag } from '@/types/menu';

interface MenuDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  menu: Menu | null;
  mealPlans: { id: string; name: string }[];
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  ftour: 'Ftour',
  snacks: 'Snacks',
  custom: 'Custom',
};

const DIETARY_TAG_INFO: Record<DietaryTag, { label: string; icon: string }> = {
  vegetarian: { label: 'Vegetarian', icon: '🥬' },
  vegan: { label: 'Vegan', icon: '🌱' },
  halal: { label: 'Halal', icon: '☪️' },
  'gluten-free': { label: 'Gluten-Free', icon: '🌾' },
  'dairy-free': { label: 'Dairy-Free', icon: '🥛' },
  'nut-free': { label: 'Nut-Free', icon: '🥜' },
};

export default function MenuDetailsModal({ isOpen, onClose, menu, mealPlans }: MenuDetailsModalProps) {
  if (!isOpen || !menu) return null;

  const getMealPlanName = (mealPlanId: string) => {
    return mealPlans.find(mp => mp.id === mealPlanId)?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{menu.name}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium">
                  {MEAL_TYPE_LABELS[menu.mealType]}
                </span>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  menu.status === 'active'
                    ? 'bg-green-500/20 text-white'
                    : 'bg-white/20 text-white'
                }`}>
                  {menu.status}
                </span>
                {menu.isSeasonal && (
                  <span className="px-4 py-2 bg-orange-500/20 text-white rounded-full text-sm font-medium">
                    Seasonal
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Icons.Close className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Description */}
          {menu.shortDescription && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl">
              <p className="text-slate-700">{menu.shortDescription}</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Linked Meal Plans */}
            <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Linked Meal Plans</div>
              {menu.linkedMealPlans.length > 0 ? (
                <div className="space-y-2">
                  {menu.linkedMealPlans.map(mpId => (
                    <div key={mpId} className="flex items-center gap-2">
                      <Icons.FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-900 font-medium">{getMealPlanName(mpId)}</span>
                      {menu.defaultForMealPlans?.includes(mpId) && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                          Default
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-400">Not linked to any meal plans</span>
              )}
            </div>

            {/* Availability */}
            <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Availability</div>
              <div className="space-y-2 text-sm">
                {menu.availableDays && menu.availableDays.length > 0 ? (
                  <div>
                    <div className="text-slate-600">Available on:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {menu.availableDays.map(day => (
                        <span key={day} className="px-2 py-1 bg-slate-100 text-slate-700 rounded capitalize text-xs">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-600">Available daily</div>
                )}
                
                {menu.validDateRange && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-slate-600">Valid dates:</div>
                    <div className="font-medium text-slate-900">
                      {menu.validDateRange.start} to {menu.validDateRange.end}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visibility */}
            <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Visibility</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {menu.visibleInGuestPortal ? (
                    <Icons.CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Icons.XCircle className="w-4 h-4 text-slate-300" />
                  )}
                  <span className="text-sm text-slate-700">Guest Portal</span>
                </div>
                <div className="flex items-center gap-2">
                  {menu.visibleDuringBooking ? (
                    <Icons.CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Icons.XCircle className="w-4 h-4 text-slate-300" />
                  )}
                  <span className="text-sm text-slate-700">During Booking</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 rounded-xl">
              <div className="text-sm font-semibold text-primary uppercase mb-3">Menu Stats</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-bold text-primary">{menu.sections.length}</div>
                  <div className="text-xs text-slate-600">Sections</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {menu.sections.reduce((sum, s) => sum + s.items.length, 0)}
                  </div>
                  <div className="text-xs text-slate-600">Total Items</div>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Content */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-8 border-2 border-slate-200">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900">Menu</h3>
              </div>

              <div className="space-y-8">
                {menu.sections.map(section => (
                  <div key={section.id}>
                    <h4 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-slate-300">
                      {section.title}
                    </h4>
                    <div className="space-y-4">
                      {section.items.map(item => (
                        <div key={item.id} className="pl-4 border-l-2 border-slate-200">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              {item.description && (
                                <div className="text-sm text-slate-600 mt-1">{item.description}</div>
                              )}
                              {item.dietaryTags && item.dietaryTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {item.dietaryTags.map(tag => {
                                    const tagInfo = DIETARY_TAG_INFO[tag];
                                    return (
                                      <span key={tag} className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                                        {tagInfo?.icon} {tagInfo?.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {item.allergens && item.allergens.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-xs text-red-600">
                                    ⚠️ Allergens: {item.allergens.join(', ')}
                                  </span>
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
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
