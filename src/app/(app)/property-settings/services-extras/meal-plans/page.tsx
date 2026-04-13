"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';
// Firebase imports for menus (temporary - TODO: migrate menus to Supabase)
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import AddMealPlanForm from '@/components/extras/add-meal-plan-form';
import MealPlanDetailsModal from '@/components/extras/meal-plan-details-modal';
import AddMenuModal from '@/components/extras/add-menu-modal';
import MenusListing from '@/components/extras/menus-listing';
import MenuDetailsModal from '@/components/extras/menu-details-modal';
import DebugPanel from '@/components/extras/debug-panel';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
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

const tabs = [
  {
    id: 'services',
    label: 'Services',
    href: '/property-settings/services-extras/services',
  },
  {
    id: 'meal-plans',
    label: 'Meal Plans',
    href: '/property-settings/services-extras/meal-plans',
  },
  {
    id: 'packages',
    label: 'Packages',
    href: '/property-settings/services-extras/packages',
  },
];

export default function MealPlansPage() {
  const { user, isLoadingAuth } = useAuth();
  const propertyId = user?.propertyId || null;
  const canManage = !!user?.permissions?.extras;

  const [activeTab, setActiveTab] = useState<'all' | 'categories' | 'menus'>('all');
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  
  // Filter & Search - All Meal Plans Tab
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pricingModelFilter, setPricingModelFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');

  // Filter & Search - Categories Tab
  const [categoriesSearchTerm, setCategoriesSearchTerm] = useState('');
  const [categoriesTabCategoryFilter, setCategoriesTabCategoryFilter] = useState<string>('all');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<string>('all');
  const [categoryPricingModelFilter, setCategoryPricingModelFilter] = useState<string>('all');
  const [categoryVisibilityFilter, setCategoryVisibilityFilter] = useState<string>('all');

  // Filter & Search - Menus Tab
  const [menusSearchTerm, setMenusSearchTerm] = useState('');
  const [menusStatusFilter, setMenusStatusFilter] = useState<string>('all');
  const [menusCategoryFilter, setMenusCategoryFilter] = useState<string>('all');
  const [menusPricingModelFilter, setMenusPricingModelFilter] = useState<string>('all');
  const [menusVisibilityFilter, setMenusVisibilityFilter] = useState<string>('all');

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

  // Debug Panel
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const addDebugLog = (type: 'request' | 'response' | 'error', method: string, endpoint: string, data: any = {}) => {
    const log = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      method,
      endpoint,
      ...data,
    };
    setDebugLogs(prev => [...prev, log]);
    console.log('DEBUG:', log);
  };

  // Fetch meal plans from API
  const fetchMealPlans = async () => {
    if (!propertyId) return;
    try {
      const response = await fetch(`/api/meal-plans/list?property_id=${propertyId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch meal plans');
      }
      const data = await response.json();
      setMealPlans(data);
    } catch (err) {
      console.error('Error fetching meal plans:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch meal plans';
      // Only show toast for migration errors
      if (errorMessage.includes('migration') || errorMessage.includes('schema')) {
        alert(`Setup Required: ${errorMessage}\n\nYou need to run the migration SQL on Supabase first.`);
      }
    }
  };

  // Fetch categories from API
  const fetchCategories = async () => {
    if (!propertyId) return;
    try {
      const response = await fetch(`/api/meal-plan-categories/list?property_id=${propertyId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch categories');
      }
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
      // Only show toast for migration errors
      if (errorMessage.includes('migration') || errorMessage.includes('schema')) {
        alert(`Setup Required: ${errorMessage}\n\nYou need to run the migration SQL on Supabase first.`);
      }
    }
  };

  // Initial load and refresh
  useEffect(() => {
    if (!propertyId) return;

    fetchMealPlans();
    fetchCategories();

    // For menus, we'll keep using Firebase for now (not in scope for Supabase migration)
    const menuCol = collection(db, 'menus');
    const menuQ = query(menuCol, where('propertyId', '==', propertyId));
    const unsubMenus = onSnapshot(menuQ, (snap) => {
      const items: Menu[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMenus(items);
    });

    return () => {
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
      const response = await fetch('/api/meal-plans/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...rest,
          propertyId,
          name: `${rest.name} (Copy)`,
          status: 'Draft',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to duplicate meal plan');
      }
      
      setShowDuplicateConfirm(false);
      setMealPlanToDuplicate(null);
      
      // Refetch meal plans to show the new duplicate
      await fetchMealPlans();
    } catch (err) {
      console.error('Duplicate error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate meal plan';
      alert(errorMessage);
    }
  };

  const confirmDelete = async () => {
    if (!mealPlanToDelete || !propertyId) return;

    try {
      const response = await fetch('/api/meal-plans/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          propertyId,
          id: mealPlanToDelete.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete meal plan');
      }
      
      setShowDeleteConfirm(false);
      setMealPlanToDelete(null);
      
      // Refetch meal plans
      await fetchMealPlans();
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete meal plan';
      alert(errorMessage);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !propertyId) return;

    try {
      // Add parent category
      const requestBody = {
        action: 'create',
        propertyId,
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || null,
        parentId: newCategoryParent || null,
        displayOrder: 0,
        isActive: true,
      };

      addDebugLog('request', 'POST', '/api/meal-plan-categories/crud', { requestBody });

      const parentResponse = await fetch('/api/meal-plan-categories/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData = await parentResponse.json().catch(() => ({}));

      addDebugLog('response', 'POST', '/api/meal-plan-categories/crud', {
        status: parentResponse.status,
        responseBody: responseData,
      });

      if (!parentResponse.ok) {
        const errorMessage = responseData.error || `HTTP ${parentResponse.status}`;
        addDebugLog('error', 'POST', '/api/meal-plan-categories/crud', {
          error: errorMessage,
          status: parentResponse.status,
          responseBody: responseData,
        });
        throw new Error(errorMessage);
      }

      const parentCategory = responseData;

      // Add subcategories if this is a parent
      if (!newCategoryParent && newSubcategories.length > 0) {
        for (const subName of newSubcategories) {
          if (subName.trim()) {
            const subRequestBody = {
              action: 'create',
              propertyId,
              name: subName.trim(),
              parentId: parentCategory.id,
              displayOrder: 0,
              isActive: true,
            };

            addDebugLog('request', 'POST', '/api/meal-plan-categories/crud', { requestBody: subRequestBody });

            const subResponse = await fetch('/api/meal-plan-categories/crud', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(subRequestBody),
            });

            const subData = await subResponse.json().catch(() => ({}));

            addDebugLog('response', 'POST', '/api/meal-plan-categories/crud', {
              status: subResponse.status,
              responseBody: subData,
            });

            if (!subResponse.ok) {
              addDebugLog('error', 'POST', '/api/meal-plan-categories/crud', {
                error: subData.error || `HTTP ${subResponse.status}`,
                status: subResponse.status,
                responseBody: subData,
              });
            }
          }
        }
      }

      // Reset form
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryParent(null);
      setNewSubcategories([]);
      setShowNewCategoryModal(false);

      // Refetch categories
      await fetchCategories();
    } catch (err) {
      console.error('Error adding category:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add category';
      addDebugLog('error', 'POST', '/api/meal-plan-categories/crud', {
        error: errorMessage,
      });
      alert(errorMessage);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm('Delete this category? Associated meal plans will lose their category.') || !propertyId) return;
    try {
      const response = await fetch('/api/meal-plan-categories/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          propertyId,
          id: catId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete category');
      }
      
      // Refetch categories
      await fetchCategories();
    } catch (err) {
      console.error('Delete category error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete category';
      alert(errorMessage);
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

  const filteredCategories = useMemo(() => {
    return parentCategories.filter(cat => {
      if (categoriesSearchTerm && !cat.name.toLowerCase().includes(categoriesSearchTerm.toLowerCase())) return false;
      return true;
    });
  }, [parentCategories, categoriesSearchTerm]);

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

  const filteredMenus = useMemo(() => {
    return menus.filter(menu => {
      if (menusSearchTerm && !menu.name.toLowerCase().includes(menusSearchTerm.toLowerCase())) return false;
      if (menusStatusFilter !== 'all' && menu.status !== menusStatusFilter) return false;
      if (menusCategoryFilter !== 'all' && menu.mealPlanId !== menusCategoryFilter) return false;
      if (menusPricingModelFilter !== 'all' && menu.pricingModel !== menusPricingModelFilter) return false;
      if (menusVisibilityFilter === 'booking' && !menu.visibleOnBooking) return false;
      if (menusVisibilityFilter === 'portal' && !menu.visibleInGuestPortal) return false;
      return true;
    });
  }, [menus, menusSearchTerm, menusStatusFilter, menusCategoryFilter, menusPricingModelFilter, menusVisibilityFilter]);

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

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setPricingModelFilter('all');
    setVisibilityFilter('all');
  };

  const handleClearCategoriesFilters = () => {
    setCategoriesSearchTerm('');
    setCategoriesTabCategoryFilter('all');
    setCategoryStatusFilter('all');
    setCategoryPricingModelFilter('all');
    setCategoryVisibilityFilter('all');
  };

  const handleClearMenusFilters = () => {
    setMenusSearchTerm('');
    setMenusStatusFilter('all');
    setMenusCategoryFilter('all');
    setMenusPricingModelFilter('all');
    setMenusVisibilityFilter('all');
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
    <div className="space-y-6 overflow-x-hidden pb-96">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Meal Plans</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
              showDebugPanel
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Toggle debug panel"
          >
            <Icons.Bug className="w-4 h-4" />
            Debug {debugLogs.length > 0 && `(${debugLogs.length})`}
          </button>
          <PropertySettingsSubtabs subtabs={tabs} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mt-2 -mx-6 px-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
              activeTab === 'all'
                ? 'text-primary'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All Meal Plans
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
              activeTab === 'categories'
                ? 'text-primary'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Categories
            {activeTab === 'categories' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('menus')}
            className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
              activeTab === 'menus'
                ? 'text-primary'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Menus
            {activeTab === 'menus' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
        </div>
      </div>
              {activeTab === 'menus' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
              )}
  

      {/* All Meal Plans Tab */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {/* Add Meal Plan Button */}
          <div className="flex justify-start">
            <button
              onClick={() => {
                setMealPlanToEdit(null);
                setShowAddMealPlanModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icons.PlusCircle className="h-4 w-4" />
              Add Meal Plan
            </button>
          </div>

          {/* --- FILTER BAR --- */}
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* 1. Search Field */}
              <div className="relative flex-grow min-w-[280px]">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              {/* 2. Category Filter */}
              <div className="relative">
                <Icons.Sliders className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Category</option>
                  {categories.filter(c => !c.parentId).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Pricing Model Filter */}
              <div className="relative">
                <Icons.Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={pricingModelFilter}
                  onChange={(e) => setPricingModelFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Pricing Model</option>
                  <option value="per-guest-night">Per Guest / Night</option>
                  <option value="per-room-night">Per Room / Night</option>
                  <option value="flat-rate">Flat Rate</option>
                </select>
              </div>

              {/* 4. Status Filter */}
              <div className="relative">
                <Icons.Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Status</option>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              {/* 5. Visibility Filter */}
              <div className="relative">
                <Icons.Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Visibility</option>
                  <option value="booking">Booking Page</option>
                  <option value="portal">Guest Portal</option>
                </select>
              </div>

              {/* 6. Clear All Button - Only show if filters are set */}
              {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || pricingModelFilter !== 'all' || visibilityFilter !== 'all') && (
                <button 
                  onClick={handleClearAllFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-md transition-colors">
                  <Icons.X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
            
            {/* Active Filter Chips (Visual Feedback) - Only show if filters are set */}
            {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || pricingModelFilter !== 'all' || visibilityFilter !== 'all') && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider py-1">Active Filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Search: {searchTerm}
                  </span>
                )}
                {categoryFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Category: {getCategoryName(categoryFilter)}
                  </span>
                )}
                {pricingModelFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Pricing: {getPricingModelLabel(pricingModelFilter)}
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Status: {statusFilter}
                  </span>
                )}
                {visibilityFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Visibility: {visibilityFilter === 'booking' ? 'Booking Page' : 'Guest Portal'}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 font-medium border-b border-slate-200 bg-slate-50/30">
                <th className="py-3 px-4 border-r border-slate-50">Meal Plan</th>
                <th className="py-3 px-4 border-r border-slate-50">Category</th>
                <th className="py-3 px-4 border-r border-slate-50">Pricing Model</th>
                <th className="py-3 px-4 border-r border-slate-50">Base Price</th>
                <th className="py-3 px-4 border-r border-slate-50">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMealPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <Icons.Package className="w-12 h-12 text-slate-300" />
                      <p>No meal plans found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMealPlans.map((mp) => (
                  <tr key={mp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 border-r border-slate-50 text-sm font-semibold text-slate-900">{mp.name}</td>
                    <td className="py-3 px-4 border-r border-slate-50 text-sm text-slate-600">
                      {getCategoryName(mp.categoryId)}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50 text-sm text-slate-600">
                      {getPricingModelLabel(mp.pricingModel)}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm font-semibold text-slate-900">
                        {mp.currency || '$'}{(mp.basePrice ?? mp.adultPrice ?? 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        mp.status === 'Active' ? 'bg-green-50 text-green-700' :
                        mp.status === 'Draft' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {mp.status || 'Draft'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
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
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div>
          {/* Add Category Button */}
          <div className="flex justify-start mb-4">
            <button
              onClick={() => setShowNewCategoryModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icons.PlusCircle className="h-4 w-4" />
              Add Category
            </button>
          </div>

          {/* --- FILTER BAR --- */}
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 space-y-3 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* 1. Search Field */}
              <div className="relative flex-grow min-w-[280px]">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by category name..."
                  value={categoriesSearchTerm}
                  onChange={(e) => setCategoriesSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              {/* 2. Category Filter */}
              <div className="relative">
                <Icons.Sliders className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoriesTabCategoryFilter}
                  onChange={(e) => setCategoriesTabCategoryFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Category</option>
                  {parentCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Pricing Model Filter */}
              <div className="relative">
                <Icons.Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryPricingModelFilter}
                  onChange={(e) => setCategoryPricingModelFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Pricing Model</option>
                  <option value="per-guest-night">Per Guest / Night</option>
                  <option value="per-room-night">Per Room / Night</option>
                  <option value="flat-rate">Flat Rate</option>
                </select>
              </div>

              {/* 4. Status Filter */}
              <div className="relative">
                <Icons.Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryStatusFilter}
                  onChange={(e) => setCategoryStatusFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Status</option>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              {/* 5. Visibility Filter */}
              <div className="relative">
                <Icons.Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryVisibilityFilter}
                  onChange={(e) => setCategoryVisibilityFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Visibility</option>
                  <option value="booking">Booking Page</option>
                  <option value="portal">Guest Portal</option>
                </select>
              </div>

              {/* 6. Clear Button - Only show if filters are set */}
              {(categoriesSearchTerm || categoriesTabCategoryFilter !== 'all' || categoryStatusFilter !== 'all' || categoryPricingModelFilter !== 'all' || categoryVisibilityFilter !== 'all') && (
                <button 
                  onClick={handleClearCategoriesFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-md transition-colors">
                  <Icons.X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>

            {/* Active Filter Chips - Only show if filters are set */}
            {(categoriesSearchTerm || categoriesTabCategoryFilter !== 'all' || categoryStatusFilter !== 'all' || categoryPricingModelFilter !== 'all' || categoryVisibilityFilter !== 'all') && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider py-1">Active Filters:</span>
                {categoriesSearchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Search: {categoriesSearchTerm}
                  </span>
                )}
                {categoriesTabCategoryFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Category: {getCategoryName(categoriesTabCategoryFilter)}
                  </span>
                )}
                {categoryPricingModelFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Pricing: {getPricingModelLabel(categoryPricingModelFilter)}
                  </span>
                )}
                {categoryStatusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Status: {categoryStatusFilter}
                  </span>
                )}
                {categoryVisibilityFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Visibility: {categoryVisibilityFilter === 'booking' ? 'Booking Page' : 'Guest Portal'}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.map((cat) => (
                <div key={cat.id} className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
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
        </div>
      )}

      {/* Menus Tab */}
      {activeTab === 'menus' && (
        <div>
          {/* Add Menu Button */}
          <div className="flex justify-start mb-4">
            <button
              onClick={() => {
                setMenuToEdit(null);
                setShowAddMenuModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icons.PlusCircle className="h-4 w-4" />
              Add Menu
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 space-y-3 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* 1. Search Field */}
              <div className="relative flex-grow min-w-[280px]">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={menusSearchTerm}
                  onChange={(e) => setMenusSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              {/* 2. Category Filter */}
              <div className="relative">
                <Icons.Sliders className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={menusCategoryFilter}
                  onChange={(e) => setMenusCategoryFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Category</option>
                  {mealPlans.map(mp => (
                    <option key={mp.id} value={mp.id}>{mp.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Pricing Model Filter */}
              <div className="relative">
                <Icons.Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={menusPricingModelFilter}
                  onChange={(e) => setMenusPricingModelFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Pricing Model</option>
                  <option value="per-guest-night">Per Guest / Night</option>
                  <option value="per-room-night">Per Room / Night</option>
                  <option value="flat-rate">Flat Rate</option>
                </select>
              </div>

              {/* 4. Status Filter */}
              <div className="relative">
                <Icons.Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={menusStatusFilter}
                  onChange={(e) => setMenusStatusFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* 5. Visibility Filter */}
              <div className="relative">
                <Icons.Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={menusVisibilityFilter}
                  onChange={(e) => setMenusVisibilityFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Visibility</option>
                  <option value="booking">Booking Page</option>
                  <option value="portal">Guest Portal</option>
                </select>
              </div>

              {/* 6. Clear All Button - Only show if filters are set */}
              {(menusSearchTerm || menusCategoryFilter !== 'all' || menusStatusFilter !== 'all' || menusPricingModelFilter !== 'all' || menusVisibilityFilter !== 'all') && (
                <button 
                  onClick={handleClearMenusFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-md transition-colors">
                  <Icons.X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
            
            {/* Active Filter Chips (Visual Feedback) - Only show if filters are set */}
            {(menusSearchTerm || menusCategoryFilter !== 'all' || menusStatusFilter !== 'all' || menusPricingModelFilter !== 'all' || menusVisibilityFilter !== 'all') && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider py-1">Active Filters:</span>
                {menusSearchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Search: {menusSearchTerm}
                  </span>
                )}
                {menusCategoryFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Category: {mealPlans.find(mp => mp.id === menusCategoryFilter)?.name}
                  </span>
                )}
                {menusPricingModelFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Pricing: {menusPricingModelFilter === 'per-guest-night' ? 'Per Guest / Night' : menusPricingModelFilter === 'per-room-night' ? 'Per Room / Night' : 'Flat Rate'}
                  </span>
                )}
                {menusStatusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Status: {menusStatusFilter}
                  </span>
                )}
                {menusVisibilityFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Visibility: {menusVisibilityFilter === 'booking' ? 'Booking Page' : 'Guest Portal'}
                  </span>
                )}
              </div>
            )}
          </div>

          <MenusListing
            menus={filteredMenus}
            mealPlans={mealPlans.map(mp => ({ id: mp.id, name: mp.name }))}
            canManage={true}
            onView={handleViewMenu}
            onEdit={handleEditMenu}
            onDuplicate={handleDuplicateMenu}
            onDelete={handleDeleteMenu}
            onToggleStatus={handleToggleMenuStatus}
          />
        </div>
      )}

      {/* Dropdown Menu Portal */}
      {openDropdown && dropdownPosition && createPortal(
        <div
          className="fixed bg-white rounded-md shadow-2xl border border-slate-200 py-2 z-50 min-w-[200px]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add Category</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Standard, Premium"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Icon (emoji)</label>
                <input
                  type="text"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="e.g., 🍽️"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Parent Category (Optional)</label>
                <select
                  value={newCategoryParent || ''}
                  onChange={(e) => setNewCategoryParent(e.target.value || null)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
          onSuccess={fetchMealPlans}
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

      {/* Debug Panel */}
      <DebugPanel
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
        logs={debugLogs}
        onClear={() => setDebugLogs([])}
      />
    </div>
  );
}
