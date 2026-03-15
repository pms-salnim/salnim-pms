"use client";

import React, { useState, useMemo } from 'react';
import GuestExtrasGrid from './guest-extras-grid';
import ExtrasDetailsModal from './extras-details-modal';
import MealPlanDetailsModal from './meal-plan-details-modal-guest';
import { 
  X, 
  CheckCircle2, 
  Sparkles, 
  Utensils as UtensilsIcon,
  Package as PackageIcon,
  Search,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  Star,
  Heart,
  Share2,
  ArrowLeft,
  Grid3x3,
  List,
  Zap,
  Award,
  Clock
} from 'lucide-react';
import { GuestPortalData } from './types';

interface AllExtrasViewProps {
  data: GuestPortalData;
  setShowAllExtras: (show: boolean) => void;
  colors: {
    primary: string;
    secondary: string;
  };
  triggerToast: (message: string) => void;
  showToast: boolean;
  toastMessage: string;
}

const AllExtrasView: React.FC<AllExtrasViewProps> = ({ 
  data, 
  setShowAllExtras, 
  colors, 
  triggerToast, 
  showToast, 
  toastMessage 
}) => {
  const [selectedExtra, setSelectedExtra] = useState<any>(null);
  const [selectedMealPlan, setSelectedMealPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMealPlanModalOpen, setIsMealPlanModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'services' | 'dining' | 'packages'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'popular'>('featured');

  const { property, services, mealPlans, packages } = data;

  const openDetailsModal = (extra: any) => {
    setSelectedExtra(extra);
    setIsModalOpen(true);
  };

  const openMealPlanModal = (mealPlan: any) => {
    setSelectedMealPlan(mealPlan);
    setIsMealPlanModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsModalOpen(false);
    setSelectedExtra(null);
  };

  const closeMealPlanModal = () => {
    setIsMealPlanModalOpen(false);
    setSelectedMealPlan(null);
  };

  // Filter and sort all items
  const allItems = useMemo(() => {
    const items: any[] = [];
    
    // Add services
    if (services && (activeCategory === 'all' || activeCategory === 'services')) {
      services.forEach((service: any) => items.push({ ...service, type: 'service' }));
    }
    
    // Add meal plans
    if (mealPlans && (activeCategory === 'all' || activeCategory === 'dining')) {
      mealPlans.forEach((plan: any) => items.push({ ...plan, type: 'mealPlan' }));
    }
    
    // Add packages
    if (packages && (activeCategory === 'all' || activeCategory === 'packages')) {
      packages.forEach((pkg: any) => items.push({ ...pkg, type: 'package' }));
    }

    // Filter by search query
    const filtered = searchQuery
      ? items.filter(item => 
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.shortDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : items;

    // Sort items
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.price || a.basePrice || 0) - (b.price || b.basePrice || 0);
        case 'price-high':
          return (b.price || b.basePrice || 0) - (a.price || a.basePrice || 0);
        case 'popular':
          return (b.bookingCount || 0) - (a.bookingCount || 0);
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });
  }, [services, mealPlans, packages, searchQuery, activeCategory, sortBy]);

  const stats = useMemo(() => ({
    total: allItems.length,
    services: services?.length || 0,
    dining: mealPlans?.length || 0,
    packages: packages?.length || 0,
  }), [allItems, services, mealPlans, packages]);

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'service': return Sparkles;
      case 'mealPlan': return UtensilsIcon;
      case 'package': return PackageIcon;
      default: return Sparkles;
    }
  };

  const getCategoryColor = (type: string) => {
    switch (type) {
      case 'service': return { bg: 'from-blue-500/10 to-cyan-500/10', text: 'text-blue-600', border: 'border-blue-200', iconBg: 'bg-blue-100' };
      case 'mealPlan': return { bg: 'from-orange-500/10 to-amber-500/10', text: 'text-orange-600', border: 'border-orange-200', iconBg: 'bg-orange-100' };
      case 'package': return { bg: 'from-emerald-500/10 to-teal-500/10', text: 'text-emerald-600', border: 'border-emerald-200', iconBg: 'bg-emerald-100' };
      default: return { bg: 'from-slate-500/10 to-gray-500/10', text: 'text-slate-600', border: 'border-slate-200', iconBg: 'bg-slate-100' };
    }
  };

  const handleItemClick = (item: any) => {
    if (item.type === 'mealPlan') {
      openMealPlanModal(item);
    } else {
      openDetailsModal(item);
    }
  };

  const handleAddItem = (item: any) => {
    triggerToast(`${item.name} added to your stay!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Floating Header with Glass-morphism */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
        <div className="max-w-screen-lg mx-auto">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/5 border border-white/20 overflow-hidden">
            {/* Top Bar */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200/50">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAllExtras(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 transition-all hover:scale-110 active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-700" />
                </button>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                    Explore Extras
                  </h1>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    {stats.total} experiences available
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="p-2.5 rounded-xl hover:bg-slate-100 transition-all"
                  title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                >
                  {viewMode === 'grid' ? <List className="w-4 h-4 text-slate-600" /> : <Grid3x3 className="w-4 h-4 text-slate-600" />}
                </button>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="px-6 py-4 flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search services, dining, packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm font-medium text-slate-700"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>

            {/* Category Filters */}
            <div className="px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
              {[
                { id: 'all' as const, label: 'All', icon: Sparkles, count: stats.total },
                { id: 'services' as const, label: 'Services', icon: Sparkles, count: stats.services },
                { id: 'dining' as const, label: 'Dining', icon: UtensilsIcon, count: stats.dining },
                { id: 'packages' as const, label: 'Packages', icon: PackageIcon, count: stats.packages },
              ].map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {category.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-white/20' : 'bg-slate-200'
                    }`}>
                      {category.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - with top padding for fixed header */}
      <main className="max-w-screen-lg mx-auto px-4 pt-64 pb-12">
        {allItems.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 mb-6">
              <Search className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No results found</h3>
            <p className="text-slate-500 mb-6">
              {searchQuery ? `No extras match "${searchQuery}"` : 'No extras available in this category'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                <X className="w-4 h-4" />
                Clear search
              </button>
            )}
          </div>
        ) : (
          /* Grid or List View */
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
            {allItems.map((item, index) => {
              const Icon = getCategoryIcon(item.type);
              const colorScheme = getCategoryColor(item.type);
              const price = item.price || item.basePrice || (item.enableAgePricing ? item.adultPrice : 0) || 0;
              const hasImage = item.images?.[0] || item.imageUrl;

              return (
                <div
                  key={`${item.type}-${index}`}
                  className="group relative bg-white rounded-3xl overflow-hidden shadow-lg shadow-slate-900/5 border border-slate-200 hover:shadow-2xl hover:shadow-slate-900/10 transition-all duration-300 hover:-translate-y-1"
                >
                  {hasImage ? (
                    /* Card with Image */
                    <>
                      <div className="relative h-52 overflow-hidden bg-slate-100">
                        <img
                          src={item.images?.[0] || item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        
                        {/* Category Badge */}
                        <div className="absolute top-4 left-4">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm ${colorScheme.text} font-bold text-xs uppercase tracking-wide shadow-lg`}>
                            <Icon className="w-3.5 h-3.5" />
                            {item.type === 'mealPlan' ? 'Dining' : item.type}
                          </div>
                        </div>

                        {/* Featured Badge */}
                        {item.featured && (
                          <div className="absolute top-4 right-4">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/95 backdrop-blur-sm text-amber-900 font-bold text-xs shadow-lg">
                              <Award className="w-3 h-3" />
                              Featured
                            </div>
                          </div>
                        )}

                        {/* Content Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <h3 className="text-white font-bold text-xl mb-2 line-clamp-1">
                            {item.name}
                          </h3>
                          <p className="text-white/90 text-sm mb-4 line-clamp-2">
                            {item.shortDescription || item.description}
                          </p>

                          {/* Included Meals Pills (for meal plans) */}
                          {item.includedMeals && item.includedMeals.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-4">
                              {item.includedMeals.slice(0, 3).map((meal: string, i: number) => (
                                <span key={i} className="px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium text-white capitalize">
                                  {meal}
                                </span>
                              ))}
                              {item.includedMeals.length > 3 && (
                                <span className="px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                                  +{item.includedMeals.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-white font-bold text-2xl">
                                {property?.currency || '$'}{price.toFixed(2)}
                              </span>
                              {item.pricingModel && (
                                <span className="text-white/70 text-xs ml-2">
                                  {item.pricingModel === 'per-guest-night' && '/person/night'}
                                  {item.pricingModel === 'per-room-night' && '/room/night'}
                                  {item.pricingModel === 'one-time' && '/one-time'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleItemClick(item)}
                                className="text-white/90 hover:text-white text-sm font-semibold transition-colors underline underline-offset-2"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => handleAddItem(item)}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-xl transition-all hover:scale-105 active:scale-95 ${
                                  item.type === 'service' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' :
                                  item.type === 'mealPlan' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/30' :
                                  'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                }`}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Card without Image */
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-2xl ${colorScheme.iconBg} flex-shrink-0`}>
                          <Icon className={`w-7 h-7 ${colorScheme.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <h3 className="font-bold text-lg text-slate-900 mb-1 line-clamp-1">
                                {item.name}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-lg ${colorScheme.iconBg} ${colorScheme.text} text-xs font-semibold uppercase tracking-wide`}>
                                  {item.type === 'mealPlan' ? 'Dining' : item.type}
                                </span>
                                {item.featured && (
                                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-current" />
                                    Featured
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                            {item.shortDescription || item.description}
                          </p>

                          {/* Included Meals Pills (for meal plans) */}
                          {item.includedMeals && item.includedMeals.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-4">
                              {item.includedMeals.map((meal: string, i: number) => (
                                <span key={i} className={`px-2.5 py-1 rounded-lg ${colorScheme.iconBg} ${colorScheme.text} text-xs font-medium capitalize border ${colorScheme.border}`}>
                                  {meal}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`${colorScheme.text} font-bold text-2xl`}>
                                {property?.currency || '$'}{price.toFixed(2)}
                              </span>
                              {item.pricingModel && (
                                <span className="text-slate-500 text-xs ml-2">
                                  {item.pricingModel === 'per-guest-night' && '/person/night'}
                                  {item.pricingModel === 'per-room-night' && '/room/night'}
                                  {item.pricingModel === 'one-time' && '/one-time'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleItemClick(item)}
                                className={`${colorScheme.text} hover:underline text-sm font-semibold transition-colors`}
                              >
                                Details
                              </button>
                              <button
                                onClick={() => handleAddItem(item)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${
                                  item.type === 'service' ? 'bg-blue-600 hover:bg-blue-700' :
                                  item.type === 'mealPlan' ? 'bg-orange-600 hover:bg-orange-700' :
                                  'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-emerald-600/30 animate-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Services Details Modal */}
      <ExtrasDetailsModal
        service={selectedExtra}
        isOpen={isModalOpen}
        onClose={closeDetailsModal}
        onAddToStay={(service) => {
          triggerToast(`${service.name} added!`);
          closeDetailsModal();
        }}
        property={property}
      />

      {/* Meal Plan Details Modal */}
      <MealPlanDetailsModal
        mealPlan={selectedMealPlan}
        isOpen={isMealPlanModalOpen}
        onClose={closeMealPlanModal}
        onAddToStay={(mealPlan) => {
          triggerToast(`${mealPlan.name} added to your stay!`);
        }}
        property={{
          currency: property?.currency,
          name: property?.name,
          id: (property as any)?.propertyId || (property as any)?.slug || ''
        }}
        menus={data.menus || []}
      />
    </div>
  );
};

export default AllExtrasView;