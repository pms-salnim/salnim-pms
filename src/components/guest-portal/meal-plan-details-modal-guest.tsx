"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '@/components/icons';
import { 
  X, 
  Sparkles, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  Calendar,
  ArrowRight,
  PlusCircle,
  Utensils,
  Coffee,
  Star,
  Leaf,
  Circle,
  Menu,
  AlertCircle,
  Info,
  Tag,
  Croissant,
  Users,
  Clock
} from 'lucide-react';

interface MealPlan {
  id: string;
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  categoryId?: string;
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
  images?: string[];
  status?: string;
  visibleOnBooking?: boolean;
  visibleInGuestPortal?: boolean;
  [key: string]: any;
}

interface Menu {
  id: string;
  name: string;
  mealType?: string;
  description?: string;
  language?: string;
  linkedMealPlans?: string[];
  defaultForMealPlans?: string[];
  sections?: MenuSection[];
  availability?: {
    days?: string[];
    dateRange?: { start: string; end: string };
    seasonal?: boolean;
  };
  visibility?: {
    guestPortal?: boolean;
    booking?: boolean;
  };
  status?: string;
}

interface MenuSection {
  id: string;
  title: string;
  displayOrder: number;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: string;
  dietaryTags?: string[];
  displayOrder: number;
}

interface MealPlanDetailsModalProps {
  mealPlan: MealPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToStay: (mealPlan: MealPlan) => void;
  property?: {
    currency?: string;
    name?: string;
    id?: string;
  };
  menus?: any[];
}

const DIETARY_TAG_ICONS: Record<string, { icon: any; label: string; color: string }> = {
  vegetarian: { icon: Icons.Leaf, label: 'Vegetarian', color: 'text-green-600' },
  vegan: { icon: Icons.Leaf, label: 'Vegan', color: 'text-green-700' },
  halal: { icon: Icons.Star, label: 'Halal', color: 'text-purple-600' },
  'gluten-free': { icon: Icons.Circle, label: 'Gluten-Free', color: 'text-amber-600' },
  'dairy-free': { icon: Icons.Circle, label: 'Dairy-Free', color: 'text-blue-600' },
  'nut-free': { icon: Icons.Circle, label: 'Nut-Free', color: 'text-red-600' },
};

const MEAL_TYPE_ICONS: Record<string, { icon: any; label: string; color: string }> = {
  breakfast: { icon: Icons.Coffee, label: 'Breakfast', color: 'text-amber-600' },
  lunch: { icon: Icons.Utensils, label: 'Lunch', color: 'text-blue-600' },
  dinner: { icon: Icons.Utensils, label: 'Dinner', color: 'text-purple-600' },
  snacks: { icon: Icons.Croissant, label: 'Snacks', color: 'text-pink-600' },
  drinks: { icon: Icons.Coffee, label: 'Drinks', color: 'text-teal-600' },
};

export default function MealPlanDetailsModal({ mealPlan, isOpen, onClose, onAddToStay, property, menus = [] }: MealPlanDetailsModalProps) {
  const [selectedMenuTab, setSelectedMenuTab] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  // Filter menus linked to this meal plan
  const linkedMenus = useMemo(() => {
    if (!mealPlan?.id || !menus || menus.length === 0) {
      return [];
    }
    
    const filtered = menus.filter((menu: any) => 
      menu.linkedMealPlans && 
      Array.isArray(menu.linkedMealPlans) &&
      menu.linkedMealPlans.includes(mealPlan.id)
    );
    
    // Sort menus: default first, then by meal type
    return filtered.sort((a: any, b: any) => {
      const aIsDefault = a.defaultForMealPlans?.includes(mealPlan.id);
      const bIsDefault = b.defaultForMealPlans?.includes(mealPlan.id);
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return 0;
    });
  }, [mealPlan?.id, menus]);

  useEffect(() => {
    if (isOpen && mealPlan) {
      setSelectedImage(0);
      // Set first menu as selected when modal opens
      if (linkedMenus.length > 0) {
        setSelectedMenuTab(linkedMenus[0].id);
      }
    } else {
      setSelectedMenuTab(null);
      setSelectedImage(0);
    }
  }, [isOpen, mealPlan, linkedMenus]);



  if (!isOpen || !mealPlan) return null;

  const heroImage = mealPlan.images?.[0];
  const currency = property?.currency || '$';

  const getPricingLabel = () => {
    switch (mealPlan.pricingModel) {
      case 'per-guest-night':
        return 'Per Guest / Per Night';
      case 'per-room-night':
        return 'Per Room / Per Night';
      case 'flat-rate':
        return 'Flat Rate per Stay';
      default:
        return '';
    }
  };

  const selectedMenu = linkedMenus.find(m => m.id === selectedMenuTab);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl shadow-orange-500/20 max-w-5xl w-full h-[92vh] overflow-hidden flex flex-col">
        
        {/* Premium Hero Section */}
        <div className="relative h-64 flex-shrink-0">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-orange-800 to-orange-900 overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-96 h-96 bg-orange-400 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            </div>
          </div>

          {/* Image Carousel */}
          <div className="relative h-full">
            <img
              src={mealPlan.images?.[selectedImage] || heroImage || '/images/meal-plan.jpg'}
              alt={mealPlan.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
            
            {/* Image Navigation Dots */}
            {mealPlan.images && mealPlan.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {mealPlan.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      selectedImage === index
                        ? 'bg-white w-8'
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 hover:rotate-90 z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl p-6 border border-white/20 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-500/20 backdrop-blur-sm">
                      <Utensils className="w-5 h-5 text-orange-200" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      {mealPlan.name}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mealPlan.includedMeals?.map((meal) => (
                      <span
                        key={meal}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 backdrop-blur-sm text-orange-100 border border-orange-400/30"
                      >
                        {meal}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-300" fill="currentColor" />
                  <span className="text-xs font-bold text-amber-100">Premium</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(92vh - 256px - 88px)' }}>
          
          {/* Pricing Section */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-600/30">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Pricing</h3>
            </div>
            
            {mealPlan.enableAgePricing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Adult Pricing */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-xl shadow-slate-900/50 group hover:shadow-2xl hover:shadow-orange-600/30 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-orange-400" />
                    <p className="text-sm font-medium text-slate-300">Adult (13+ years)</p>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-white">
                      {mealPlan.adultPrice?.toFixed(2)}
                    </span>
                    <span className="text-base text-slate-400">{currency}</span>
                  </div>
                  <p className="text-xs text-slate-400">{getPricingLabel()}</p>
                </div>

                {/* Child Pricing */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-xl shadow-slate-900/50 group hover:shadow-2xl hover:shadow-orange-600/30 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-blue-400" />
                    <p className="text-sm font-medium text-slate-300">Child (3-12 years)</p>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-white">
                      {mealPlan.childPrice?.toFixed(2)}
                    </span>
                    <span className="text-base text-slate-400">{currency}</span>
                  </div>
                  <p className="text-xs text-slate-400">{getPricingLabel()}</p>
                </div>

                {/* Infant Pricing */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-xl shadow-slate-900/50 group hover:shadow-2xl hover:shadow-orange-600/30 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-purple-400" />
                    <p className="text-sm font-medium text-slate-300">Infant (0-2 years)</p>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    {mealPlan.infantFree ? (
                      <span className="text-4xl font-bold text-emerald-400">Free</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-white">
                          {mealPlan.infantPrice?.toFixed(2)}
                        </span>
                        <span className="text-base text-slate-400">{currency}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{getPricingLabel()}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-orange-900 via-orange-800 to-orange-900 rounded-2xl p-6 border border-orange-700 shadow-xl shadow-orange-900/50">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-4xl font-bold text-white">
                      {mealPlan.basePrice?.toFixed(2)}
                    </span>
                    <span className="text-base text-orange-200">{currency}</span>
                  </div>
                  <p className="text-sm text-orange-200">{getPricingLabel()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {mealPlan.fullDescription && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg">
              <div className="flex items-center gap-2.5 mb-4">
                <FileText className="w-5 h-5 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">About This Plan</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {mealPlan.fullDescription}
              </p>
            </div>
          )}

          {/* Included Meals */}
          {mealPlan.includedMeals && mealPlan.includedMeals.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/30">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">What's Included</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {mealPlan.includedMeals.map((meal) => {
                  const mealInfo = MEAL_TYPE_ICONS[meal.toLowerCase()];
                  const MealIcon = mealInfo?.icon || Icons.Utensils;
                  return (
                    <div
                      key={meal}
                      className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors duration-300">
                          <MealIcon className={`w-5 h-5 ${mealInfo?.color || 'text-emerald-600'}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 capitalize">{meal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Menus */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-600/30">
                <Menu className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Menus</h3>
            </div>

            {linkedMenus.length > 0 ? (
              <>
                {/* Menu Tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">{linkedMenus.map((menu: any) => {
                  const isDefault = menu.defaultForMealPlans?.includes(mealPlan.id || '');
                  const mealTypeInfo = menu.mealType ? MEAL_TYPE_ICONS[menu.mealType.toLowerCase()] : null;
                  const MenuIcon = mealTypeInfo?.icon || Icons.Utensils;
                  
                  return (
                    <button
                      key={menu.id}
                      onClick={() => setSelectedMenuTab(menu.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                        selectedMenuTab === menu.id
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:text-purple-600 hover:shadow-md'
                      }`}
                    >
                      <MenuIcon className="w-4 h-4" />
                      <span className="text-sm">{menu.name}</span>
                      {isDefault && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          selectedMenuTab === menu.id ? 'bg-white/20' : 'bg-purple-100 text-purple-700'
                        }`}>
                          Default
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Menu Content */}
              {selectedMenu && (
                <div className="space-y-4">
                  {/* Menu Description */}
                  {selectedMenu.description && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                      <p className="text-sm text-slate-700 leading-relaxed">{selectedMenu.description}</p>
                    </div>
                  )}

                  {/* Menu Sections */}
                  {selectedMenu.sections && selectedMenu.sections.length > 0 ? (
                    selectedMenu.sections
                      ?.sort((a: any, b: any) => a.displayOrder - b.displayOrder)
                      .map((section: any) => (
                        <div
                          key={section.id}
                          className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 border border-slate-200 shadow-lg"
                        >
                          <h4 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full"></div>
                            {section.name}
                          </h4>
                          
                          {section.description && (
                            <p className="text-xs text-slate-600 mb-4 italic">{section.description}</p>
                          )}
                          
                          <div className="space-y-3">
                            {section.items && section.items.length > 0 ? (
                              section.items
                                ?.sort((a: any, b: any) => a.displayOrder - b.displayOrder)
                                .map((item: any) => (
                              <div
                                key={item.id}
                                className="bg-white rounded-xl p-4 border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300 group"
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="text-sm font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                                        {item.name}
                                      </h5>
                                      {item.dietaryTags && item.dietaryTags.length > 0 && (
                                        <div className="flex gap-1">
                                          {item.dietaryTags.map((tag: string) => {
                                            const tagInfo = DIETARY_TAG_ICONS[tag];
                                            if (!tagInfo) return null;
                                            const TagIcon = tagInfo.icon;
                                            return (
                                              <div
                                                key={tag}
                                                className="p-1 rounded bg-slate-100 group-hover:bg-purple-50 transition-colors"
                                                title={tagInfo.label}
                                              >
                                                <TagIcon className={`w-3.5 h-3.5 ${tagInfo.color} group-hover:text-purple-500`} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-xs text-slate-500 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                  {item.price && (
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-base font-bold text-slate-800">
                                        {item.price}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-sm text-slate-500">
                              No items in this section
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-lg text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                        <Menu className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-600">No menu sections available</p>
                    </div>
                  )}
                </div>
              )}
              </>
            ) : (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200 shadow-lg text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                  <Menu className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-2">No Menus Available</p>
                <p className="text-xs text-slate-500">This meal plan doesn't have any linked menus yet.</p>
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mealPlan.minimumStay && mealPlan.minimumStay > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-200 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-blue-500/20">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-blue-900">Minimum Stay</h4>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {mealPlan.minimumStay}
                </p>
                <p className="text-xs text-blue-600 mt-1">night{mealPlan.minimumStay > 1 ? 's' : ''} required</p>
              </div>
            )}

            {mealPlan.upgradeAllowed && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20">
                    <ArrowRight className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-emerald-900">Upgradeable</h4>
                </div>
                <p className="text-sm text-emerald-700 leading-relaxed">
                  Can be upgraded after booking
                </p>
              </div>
            )}

            {mealPlan.cancellationPolicy && (
              <div className="md:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-amber-900">Cancellation Policy</h4>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {mealPlan.cancellationPolicy}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Premium Footer */}
        <div className="flex-shrink-0 p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-center sm:text-left">
                <p className="text-xs text-slate-400">Starting from</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    {mealPlan.enableAgePricing ? mealPlan.adultPrice?.toFixed(2) : mealPlan.basePrice?.toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-400">{currency}</span>
                </div>
                <p className="text-xs text-slate-400">{getPricingLabel()}</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-white/5 transition-all duration-300 text-base font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onAddToStay(mealPlan);
                  onClose();
                }}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-600/40 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 text-base font-medium flex items-center justify-center gap-2 group"
              >
                <span>Add to My Stay</span>
                <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
