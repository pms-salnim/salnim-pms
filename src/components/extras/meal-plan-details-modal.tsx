"use client";

import React from 'react';
import { Icons } from '@/components/icons';

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

interface MealPlan {
  id: string;
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  mealPlanType?: string;
  includedMeals?: string[];
  pricingModel?: string;
  basePrice?: number;
  adultPrice?: number;
  childPrice?: number;
  infantPrice?: number;
  infantFree?: boolean;
  enableAgePricing?: boolean;
  minimumStay?: number;
  cancellationPolicy?: string;
  upgradeAllowed?: boolean;
  isDefault?: boolean;
  visibleOnBooking?: boolean;
  visibleInGuestPortal?: boolean;
  status?: string;
  currency?: string;
  images?: string[];
}

interface MealPlanDetailsModalProps {
  mealPlan: MealPlan | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
}

const MEAL_LABELS: { [key: string]: string } = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  drinks: 'Drinks',
};

const MEAL_PLAN_TYPE_LABELS: { [key: string]: string } = {
  breakfast: 'Breakfast',
  'half-board': 'Half Board',
  'full-board': 'Full Board',
  'all-inclusive': 'All Inclusive',
  custom: 'Custom',
};

const PRICING_MODEL_LABELS: { [key: string]: string } = {
  'per-guest-night': 'Per Guest / Night',
  'per-room-night': 'Per Room / Night',
  'flat-rate': 'Flat Rate per Stay',
};

export default function MealPlanDetailsModal({ mealPlan, isOpen, onClose, categories }: MealPlanDetailsModalProps) {
  if (!isOpen || !mealPlan) return null;

  const getCategoryName = (catId?: string | null) => {
    if (!catId) return null;
    return categories.find(c => c.id === catId)?.name || null;
  };

  const currency = mealPlan.currency || '$';
  const categoryName = getCategoryName(mealPlan.categoryId);
  const subcategoryName = getCategoryName(mealPlan.subcategoryId);
  const heroImage = mealPlan.images?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Hero Banner */}
        <div className="relative h-64 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
          {heroImage ? (
            <>
              <img 
                src={heroImage} 
                alt={mealPlan.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <Icons.Utensils className="w-12 h-12 text-primary" />
              </div>
            </div>
          )}
          
          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                    {MEAL_PLAN_TYPE_LABELS[mealPlan.mealPlanType || ''] || mealPlan.mealPlanType}
                  </span>
                  {mealPlan.isDefault && (
                    <span className="px-3 py-1 bg-yellow-500/90 backdrop-blur-sm rounded-full text-xs font-bold">
                      DEFAULT
                    </span>
                  )}
                </div>
                <h2 className="text-3xl font-bold drop-shadow-lg">{mealPlan.name}</h2>
                {mealPlan.shortDescription && (
                  <p className="text-white/90 mt-2 text-sm">{mealPlan.shortDescription}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
              >
                <Icons.Close className="w-5 h-5 text-slate-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-256px)] p-6 space-y-6">
          {/* Pricing Section */}
          {mealPlan.enableAgePricing ? (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Icons.DollarSign className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900">Age-Based Pricing</h3>
              </div>
              <div className="text-sm text-slate-500 mb-4">
                {PRICING_MODEL_LABELS[mealPlan.pricingModel || ''] || mealPlan.pricingModel}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="text-sm text-slate-500 mb-1">Adult</div>
                  <div className="text-2xl font-bold text-primary">{currency}{(mealPlan.adultPrice || 0).toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="text-sm text-slate-500 mb-1">Child</div>
                  <div className="text-2xl font-bold text-primary">{currency}{(mealPlan.childPrice || 0).toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="text-sm text-slate-500 mb-1">Infant</div>
                  {mealPlan.infantFree ? (
                    <div className="text-xl font-bold text-green-600">FREE</div>
                  ) : (
                    <div className="text-2xl font-bold text-primary">{currency}{(mealPlan.infantPrice || 0).toFixed(2)}</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600 mb-1">Base Price</div>
                  <div className="text-4xl font-bold text-primary">{currency}{(mealPlan.basePrice || 0).toFixed(2)}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {PRICING_MODEL_LABELS[mealPlan.pricingModel || ''] || mealPlan.pricingModel}
                  </div>
                </div>
                <Icons.Sparkles className="w-12 h-12 text-primary/30" />
              </div>
            </div>
          )}

          {/* Included Meals */}
          {mealPlan.includedMeals && mealPlan.includedMeals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icons.CheckCircle2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900">Included Meals</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {mealPlan.includedMeals.map((meal, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icons.Utensils className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-slate-700">{MEAL_LABELS[meal] || meal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Description */}
          {mealPlan.fullDescription && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icons.FileText className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900">Description</h3>
              </div>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                {mealPlan.fullDescription}
              </p>
            </div>
          )}

          {/* Category & Details */}
          <div className="grid grid-cols-2 gap-4">
            {categoryName && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <Icons.Tag className="w-4 h-4" />
                  <span className="text-xs font-medium">Category</span>
                </div>
                <div className="font-semibold text-slate-900">{categoryName}</div>
                {subcategoryName && (
                  <div className="text-sm text-slate-500 mt-1">{subcategoryName}</div>
                )}
              </div>
            )}

            {mealPlan.minimumStay && mealPlan.minimumStay > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <Icons.Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium">Minimum Stay</span>
                </div>
                <div className="font-semibold text-slate-900">{mealPlan.minimumStay} night{mealPlan.minimumStay > 1 ? 's' : ''}</div>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Icons.Globe className="w-4 h-4" />
                <span className="text-xs font-medium">Booking Page</span>
              </div>
              <div className="flex items-center gap-2">
                {mealPlan.visibleOnBooking ? (
                  <>
                    <Icons.CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-700">Visible</span>
                  </>
                ) : (
                  <>
                    <Icons.XCircle className="w-5 h-5 text-slate-400" />
                    <span className="font-semibold text-slate-500">Hidden</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Icons.User className="w-4 h-4" />
                <span className="text-xs font-medium">Guest Portal</span>
              </div>
              <div className="flex items-center gap-2">
                {mealPlan.visibleInGuestPortal ? (
                  <>
                    <Icons.CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-700">Visible</span>
                  </>
                ) : (
                  <>
                    <Icons.XCircle className="w-5 h-5 text-slate-400" />
                    <span className="font-semibold text-slate-500">Hidden</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Cancellation Policy */}
          {mealPlan.cancellationPolicy && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icons.AlertCircle className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900">Cancellation Policy</h3>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <p className="text-slate-700 whitespace-pre-line">{mealPlan.cancellationPolicy}</p>
              </div>
            </div>
          )}

          {/* Additional Features */}
          <div className="flex flex-wrap gap-3">
            {mealPlan.upgradeAllowed && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-200">
                <Icons.TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Upgrade Allowed</span>
              </div>
            )}
            {mealPlan.isDefault && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-full border border-yellow-200">
                <Icons.Star className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700">Default Meal Plan</span>
              </div>
            )}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
              mealPlan.status === 'Active' ? 'bg-green-50 border-green-200' :
              mealPlan.status === 'Draft' ? 'bg-slate-50 border-slate-200' :
              'bg-red-50 border-red-200'
            }`}>
              <span className={`text-sm font-medium ${
                mealPlan.status === 'Active' ? 'text-green-700' :
                mealPlan.status === 'Draft' ? 'text-slate-600' :
                'text-red-700'
              }`}>
                {mealPlan.status}
              </span>
            </div>
          </div>

          {/* Image Gallery */}
          {mealPlan.images && mealPlan.images.length > 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Icons.ImageIcon className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900">Gallery</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {mealPlan.images.slice(1).map((img, idx) => (
                  <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-slate-200">
                    <img src={img} alt={`${mealPlan.name} ${idx + 2}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
