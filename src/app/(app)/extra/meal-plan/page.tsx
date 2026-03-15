"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Icons } from '@/components/icons';
import AddMealPlanForm from '@/components/extras/add-meal-plan-form';
import MealPlanDetailsModal from '@/components/extras/meal-plan-details-modal';
import AddMenuModal from '@/components/extras/add-menu-modal';
import MenusListing from '@/components/extras/menus-listing';
import MenuDetailsModal from '@/components/extras/menu-details-modal';
import type { Menu } from '@/types/menu';

type Category = { 
  id: string; 
  name: string; 
  icon?: string;
  description?: string;
  displayOrder?: number;
  visibleOnBooking?: boolean;
  parentId?: string | null;
};

type MealPlan = { 
  id: string; 
  name: string; 
  shortDescription?: string;
  fullDescription?: string;
  categoryId?: string | null; 
  subcategoryId?: string | null;
  mealPlanType?: string; // breakfast, half-board, full-board, all-inclusive, custom
  includedMeals?: string[]; // ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks']
  pricingModel?: string; // per-guest-night, per-room-night, flat-rate
  basePrice?: number;
  adultPrice?: number;
  childPrice?: number;
  infantPrice?: number;
  infantFree?: boolean;
  enableAgePricing?: boolean;
  availableDates?: { start: string; end: string };
  minimumStay?: number;
  blackoutDates?: string[];
  cancellationPolicy?: string;
  upgradeAllowed?: boolean;
  applicableRoomTypes?: string[];
  isDefault?: boolean;
  visibleOnBooking?: boolean;
  visibleInGuestPortal?: boolean;
  status?: 'Active' | 'Draft' | 'Archived';
  currency?: string;
  images?: string[];
  createdAt?: any;
  updatedAt?: any;
};

export default function MealPlansPage() {
  const { user, isLoadingAuth } = useAuth();
  const propertyId = user?.propertyId || null;
  const canManage = !!user?.permissions?.extras;

  const [activeTab, setActiveTab] = useState<'all' | 'categories' | 'menus'>('all');
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  
  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pricingModelFilter, setPricingModelFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');

  // Modals
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showAddMealPlanModal, setShowAddMealPlanModal] = useState(false);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMenuDetailsModal, setShowMenuDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [mealPlanToDelete, setMealPlanToDelete] = useState<MealPlan | null>(null);
  const [mealPlanToDuplicate, setMealPlanToDuplicate] = useState<MealPlan | null>(null);
  const [mealPlanToEdit, setMealPlanToEdit] = useState<MealPlan | null>(null);
  const [menuToEdit, setMenuToEdit] = useState<Menu | null>(null);
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);
  const [menuToDuplicate, setMenuToDuplicate] = useState<Menu | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; right?: number } | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [newSubcategories, setNewSubcategories] = useState<string[]>([]);

  useEffect(() => {
    if (!propertyId) return;

    const catCol = collection(db, 'mealPlanCategories');
    const catQ = query(catCol, where('propertyId', '==', propertyId));
    const unsubCats = onSnapshot(catQ, (snap) => {
      const items: Category[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setCategories(items);
    });

    const mealCol = collection(db, 'mealPlans');
    const mealQ = query(mealCol, where('propertyId', '==', propertyId));
    const unsubMeals = onSnapshot(mealQ, (snap) => {
      const items: MealPlan[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMealPlans(items);
    });

    const menuCol = collection(db, 'menus');
    const menuQ = query(menuCol, where('propertyId', '==', propertyId));
    const unsubMenus = onSnapshot(menuQ, (snap) => {
      const items: Menu[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMenus(items);
    });

    return () => {
      unsubCats();
      unsubMeals();
      unsubMenus();
    };
  }, [propertyId]);

  // Update dropdown position on scroll/resize
  useEffect(() => {
    if (!openDropdown) return;

    const handleScroll = () => {
      if (openDropdown) {
        updateDropdownPosition(openDropdown);
      }
    };

    const handleResize = () => {
      if (openDropdown) {
        updateDropdownPosition(openDropdown);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [openDropdown]);

  const updateDropdownPosition = (mealPlanId: string) => {
    const buttonEl = dropdownRefs.current[mealPlanId];
    if (!buttonEl) return;

    const rect = buttonEl.getBoundingClientRect();
    const dropdownHeight = 200; // approximate
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + window.scrollY;
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      top = rect.top + window.scrollY - dropdownHeight;
    }

    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight < 200) {
      setDropdownPosition({ top, left: rect.left + window.scrollX, right: window.innerWidth - rect.right });
    } else {
      setDropdownPosition({ top, left: rect.left + window.scrollX });
    }
  };

  const toggleDropdown = (mealPlanId: string) => {
    if (openDropdown === mealPlanId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else {
      setOpenDropdown(mealPlanId);
      updateDropdownPosition(mealPlanId);
    }
  };

  const handleView = (mp: MealPlan) => {
    setSelectedMealPlan(mp);
    setShowDetailsModal(true);
    setOpenDropdown(null);
  };

  const handleEdit = (mp: MealPlan) => {
    setMealPlanToEdit(mp);
    setShowAddMealPlanModal(true);
    setOpenDropdown(null);
  };

  const handleDuplicate = (mp: MealPlan) => {
    setMealPlanToDuplicate(mp);
    setShowDuplicateConfirm(true);
    setOpenDropdown(null);
  };

  const handleDelete = (mp: MealPlan) => {
    setMealPlanToDelete(mp);
    setShowDeleteConfirm(true);
    setOpenDropdown(null);
  };

  const confirmDuplicate = async () => {
    if (!mealPlanToDuplicate || !propertyId) return;

    try {
      const { id, createdAt, updatedAt, ...rest } = mealPlanToDuplicate;
      await addDoc(collection(db, 'mealPlans'), {
        ...rest,
        name: `${rest.name} (Copy)`,
        propertyId,
        status: 'Draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowDuplicateConfirm(false);
      setMealPlanToDuplicate(null);
    } catch (err) {
      console.error('Duplicate error:', err);
      alert('Failed to duplicate meal plan');
    }
  };

  const confirmDelete = async () => {
    if (!mealPlanToDelete) return;

    try {
      await deleteDoc(doc(db, 'mealPlans', mealPlanToDelete.id));
      setShowDeleteConfirm(false);
      setMealPlanToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete meal plan');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !propertyId) return;

    try {
      const catData: any = {
        name: newCategoryName.trim(),
        icon: newCategoryIcon.trim() || '',
        description: newCategoryDescription.trim() || '',
        propertyId,
        parentId: newCategoryParent || null,
        displayOrder: 0,
        visibleOnBooking: true,
        createdAt: serverTimestamp(),
      };

      const catRef = await addDoc(collection(db, 'mealPlanCategories'), catData);

      // Add subcategories if parent
      if (!newCategoryParent && newSubcategories.length > 0) {
        for (const subName of newSubcategories) {
          if (subName.trim()) {
            await addDoc(collection(db, 'mealPlanCategories'), {
              name: subName.trim(),
              propertyId,
              parentId: catRef.id,
              displayOrder: 0,
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      // Reset
      setNewCategoryName('');
      setNewCategoryIcon('');
      setNewCategoryDescription('');
      setNewCategoryParent(null);
      setNewSubcategories([]);
      setShowNewCategoryModal(false);
    } catch (err) {
      console.error('Error adding category:', err);
      alert('Failed to add category');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm('Delete this category? Associated meal plans will lose their category.')) return;
    try {
      await deleteDoc(doc(db, 'mealPlanCategories', catId));
    } catch (err) {
      console.error('Delete category error:', err);
      alert('Failed to delete category');
    }
  };

  // Menu handlers
  const handleViewMenu = (menu: Menu) => {
    setSelectedMenu(menu);
    setShowMenuDetailsModal(true);
  };

  const handleEditMenu = (menu: Menu) => {
    setMenuToEdit(menu);
    setShowAddMenuModal(true);
  };

  const handleDuplicateMenu = async (menu: Menu) => {
    if (!propertyId) return;
    try {
      const { id, createdAt, updatedAt, createdBy, ...rest } = menu;
      await addDoc(collection(db, 'menus'), {
        ...rest,
        name: `${rest.name} (Copy)`,
        status: 'draft',
        propertyId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'unknown',
      });
    } catch (err) {
      console.error('Duplicate menu error:', err);
      alert('Failed to duplicate menu');
    }
  };

  const handleDeleteMenu = async (menu: Menu) => {
    if (!window.confirm(`Delete menu "${menu.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'menus', menu.id));
    } catch (err) {
      console.error('Delete menu error:', err);
      alert('Failed to delete menu');
    }
  };

  const handleToggleMenuStatus = async (menu: Menu) => {
    try {
      await updateDoc(doc(db, 'menus', menu.id), {
        status: menu.status === 'active' ? 'draft' : 'active',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Toggle menu status error:', err);
      alert('Failed to update menu status');
    }
  };

  const parentCategories = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const subcategoriesMap = useMemo(() => {
    const map: { [key: string]: Category[] } = {};
    categories.forEach(c => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    return map;
  }, [categories]);

  const filteredMealPlans = useMemo(() => {
    return mealPlans.filter(mp => {
      if (searchTerm && !mp.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (categoryFilter !== 'all' && mp.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && mp.status !== statusFilter) return false;
      if (pricingModelFilter !== 'all' && mp.pricingModel !== pricingModelFilter) return false;
      if (visibilityFilter === 'booking' && !mp.visibleOnBooking) return false;
      if (visibilityFilter === 'portal' && !mp.visibleInGuestPortal) return false;
      return true;
    });
  }, [mealPlans, searchTerm, categoryFilter, statusFilter, pricingModelFilter, visibilityFilter]);

  const getCategoryName = (catId?: string | null) => {
    if (!catId) return '—';
    return categories.find(c => c.id === catId)?.name || '—';
  };

  const getPricingModelLabel = (model?: string) => {
    switch (model) {
      case 'per-guest-night': return 'Per Guest / Night';
      case 'per-room-night': return 'Per Room / Night';
      case 'flat-rate': return 'Flat Rate';
      default: return '—';
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.Spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!propertyId || !canManage) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">You do not have permission to manage meal plans.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Meal Plans</h1>
              <p className="text-slate-600 mt-2">Manage meal plan offerings for your property</p>
            </div>
            {activeTab !== 'menus' ? (
              <button
                onClick={() => {
                  setMealPlanToEdit(null);
                  setShowAddMealPlanModal(true);
                }}
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                <Icons.PlusCircle className="w-5 h-5" />
                Add Meal Plan
              </button>
            ) : (
              <button
                onClick={() => {
                  setMenuToEdit(null);
                  setShowAddMenuModal(true);
                }}
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                <Icons.PlusCircle className="w-5 h-5" />
                Add Menu
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-1 font-semibold transition-all relative ${
                activeTab === 'all'
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Meal Plans
              {activeTab === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`pb-3 px-1 font-semibold transition-all relative ${
                activeTab === 'categories'
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Categories
              {activeTab === 'categories' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('menus')}
              className={`pb-3 px-1 font-semibold transition-all relative ${
                activeTab === 'menus'
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Menus
              {activeTab === 'menus' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
            </button>
          </div>
        </div>

        {/* All Meal Plans Tab */}
        {activeTab === 'all' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
                  <div className="relative">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search meal plans..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="all">All Categories</option>
                    {parentCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="all">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                {/* Pricing Model Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pricing Model</label>
                  <select
                    value={pricingModelFilter}
                    onChange={(e) => setPricingModelFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="all">All Models</option>
                    <option value="per-guest-night">Per Guest / Night</option>
                    <option value="per-room-night">Per Room / Night</option>
                    <option value="flat-rate">Flat Rate</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <label className="block text-sm font-medium text-slate-700">Visibility:</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setVisibilityFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      visibilityFilter === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVisibilityFilter('booking')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      visibilityFilter === 'booking'
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Booking Page
                  </button>
                  <button
                    onClick={() => setVisibilityFilter('portal')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      visibilityFilter === 'portal'
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Guest Portal
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Meal Plan</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Pricing Model</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Base Price</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Booking Page</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Guest Portal</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMealPlans.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-3">
                            <Icons.Package className="w-12 h-12 text-slate-300" />
                            <p>No meal plans found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMealPlans.map((mp) => (
                        <tr key={mp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                <Icons.Utensils className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{mp.name}</div>
                                {mp.shortDescription && (
                                  <div className="text-sm text-slate-500 line-clamp-1">{mp.shortDescription}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {mp.mealPlanType?.replace(/-/g, ' ') || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {getCategoryName(mp.categoryId)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {getPricingModelLabel(mp.pricingModel)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">
                              {mp.currency || '$'}{(mp.basePrice ?? mp.adultPrice ?? 0).toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {mp.visibleOnBooking ? (
                              <Icons.CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <Icons.XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {mp.visibleInGuestPortal ? (
                              <Icons.CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <Icons.XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              mp.status === 'Active' ? 'bg-green-50 text-green-700' :
                              mp.status === 'Draft' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {mp.status || 'Draft'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              ref={(el) => { dropdownRefs.current[mp.id] = el; }}
                              onClick={() => toggleDropdown(mp.id)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Icons.MoreVertical className="w-5 h-5 text-slate-600" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewCategoryModal(true)}
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                <Icons.PlusCircle className="w-5 h-5" />
                Add Category
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parentCategories.map((cat) => (
                <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl">{cat.icon || '📋'}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{cat.name}</h3>
                        {cat.description && (
                          <p className="text-sm text-slate-500 mt-1">{cat.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Icons.Trash className="w-4 h-4 text-red-600" />
                    </button>
                  </div>

                  {subcategoriesMap[cat.id] && subcategoriesMap[cat.id].length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Sub-Categories</p>
                      <div className="space-y-2">
                        {subcategoriesMap[cat.id].map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-700">{sub.name}</span>
                            <button
                              onClick={() => handleDeleteCategory(sub.id)}
                              className="p-1 hover:bg-red-50 rounded transition-colors"
                            >
                              <Icons.Trash className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menus Tab */}
        {activeTab === 'menus' && (
          <MenusListing
            menus={menus}
            mealPlans={mealPlans.map(mp => ({ id: mp.id, name: mp.name }))}
            canManage={true}
            onView={handleViewMenu}
            onEdit={handleEditMenu}
            onDuplicate={handleDuplicateMenu}
            onDelete={handleDeleteMenu}
            onToggleStatus={handleToggleMenuStatus}
          />
        )}
      </div>

      {/* Dropdown Menu Portal */}
      {openDropdown && dropdownPosition && createPortal(
        <div
          className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 min-w-[200px]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: dropdownPosition.right ? 'auto' : `${dropdownPosition.left}px`,
            right: dropdownPosition.right ? `${dropdownPosition.right}px` : 'auto',
          }}
        >
          <button
            onClick={() => handleView(mealPlans.find(s => s.id === openDropdown)!)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <Icons.Eye className="w-4 h-4" />
            View Details
          </button>
          <button
            onClick={() => handleEdit(mealPlans.find(s => s.id === openDropdown)!)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <Icons.Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => handleDuplicate(mealPlans.find(s => s.id === openDropdown)!)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <Icons.Copy className="w-4 h-4" />
            Duplicate
          </button>
          <div className="my-1 border-t border-slate-200"></div>
          <button
            onClick={() => handleDelete(mealPlans.find(s => s.id === openDropdown)!)}
            className="w-full px-4 py-2.5 text-left hover:bg-red-50 transition-colors flex items-center gap-3 text-red-600"
          >
            <Icons.Trash className="w-4 h-4" />
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Add Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add Category</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Standard, Premium"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Icon (emoji)</label>
                <input
                  type="text"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="e.g., 🍽️"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Parent Category (Optional)</label>
                <select
                  value={newCategoryParent || ''}
                  onChange={(e) => setNewCategoryParent(e.target.value || null)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">None (Main Category)</option>
                  {parentCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {!newCategoryParent && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sub-Categories (Optional)
                  </label>
                  <div className="space-y-2">
                    {newSubcategories.map((sub, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={sub}
                          onChange={(e) => {
                            const updated = [...newSubcategories];
                            updated[idx] = e.target.value;
                            setNewSubcategories(updated);
                          }}
                          placeholder="Sub-category name"
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <button
                          onClick={() => setNewSubcategories(newSubcategories.filter((_, i) => i !== idx))}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Icons.Trash className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setNewSubcategories([...newSubcategories, ''])}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Icons.PlusCircle className="w-4 h-4" />
                      Add Sub-Category
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setNewCategoryName('');
                  setNewCategoryIcon('');
                  setNewCategoryDescription('');
                  setNewCategoryParent(null);
                  setNewSubcategories([]);
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && mealPlanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Icons.AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Delete Meal Plan</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-700 mb-6">
              Are you sure you want to delete <strong>{mealPlanToDelete.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setMealPlanToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDuplicateConfirm && mealPlanToDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Duplicate Meal Plan</h3>
            <p className="text-slate-700 mb-6">
              Create a copy of <strong>{mealPlanToDuplicate.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  setMealPlanToDuplicate(null);
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDuplicate}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Meal Plan Modal */}
      {showAddMealPlanModal && (
        <AddMealPlanForm
          isOpen={showAddMealPlanModal}
          onClose={() => {
            setShowAddMealPlanModal(false);
            setMealPlanToEdit(null);
          }}
          propertyId={propertyId}
          categories={categories}
          mealPlanToEdit={mealPlanToEdit}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMealPlan && (
        <MealPlanDetailsModal
          mealPlan={selectedMealPlan}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMealPlan(null);
          }}
          categories={categories}
        />
      )}

      {/* Add/Edit Menu Modal */}
      {showAddMenuModal && (
        <AddMenuModal
          isOpen={showAddMenuModal}
          onClose={() => {
            setShowAddMenuModal(false);
            setMenuToEdit(null);
          }}
          propertyId={propertyId}
          mealPlans={mealPlans.map(mp => ({ id: mp.id, name: mp.name }))}
          menuToEdit={menuToEdit}
        />
      )}

      {/* Menu Details Modal */}
      {showMenuDetailsModal && selectedMenu && (
        <MenuDetailsModal
          isOpen={showMenuDetailsModal}
          onClose={() => {
            setShowMenuDetailsModal(false);
            setSelectedMenu(null);
          }}
          menu={selectedMenu}
          mealPlans={mealPlans.map(mp => ({ id: mp.id, name: mp.name }))}
        />
      )}
    </div>
  );
}
