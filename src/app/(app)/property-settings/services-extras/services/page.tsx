"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Icons } from '@/components/icons';
import AddServiceForm from '@/components/extras/add-service-form';
import ServiceDetailsModal from '@/components/extras/service-details-modal';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';

type Category = { 
  id: string; 
  name: string; 
  parentId?: string | null;
};

type Service = { 
  id: string; 
  name: string; 
  description?: string; 
  price?: number; 
  currency?: string; 
  categoryId?: string | null; 
  subcategoryId?: string | null;
  status?: 'Active' | 'Draft' | 'Archived';
  bookingEngine?: boolean;
  guestPortal?: boolean;
  staffOnly?: boolean;
  featuredImage?: string;
  images?: string[];
  tags?: string[];
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

export default function ServicesPage() {
  const { user, isLoadingAuth } = useAuth();
  const propertyId = user?.propertyId || null;
  const canManage = !!user?.permissions?.extras;

  const [activeTab, setActiveTab] = useState<'all' | 'structure'>('all');
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filter & Search - All Services Tab
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filter & Search - Category Structure Tab
  const [categoryStructureSearchTerm, setCategoryStructureSearchTerm] = useState('');
  const [categoryStructureCategoryFilter, setCategoryStructureCategoryFilter] = useState<string>('all');
  const [categoryStructureGroupFilter, setCategoryStructureGroupFilter] = useState<string>('all');
  const [categoryStructureStatusFilter, setCategoryStructureStatusFilter] = useState<string>('all');

  // Modals
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [serviceToDuplicate, setServiceToDuplicate] = useState<Service | null>(null);
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; right?: number } | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [newSubcategories, setNewSubcategories] = useState<string[]>([]);

  useEffect(() => {
    if (!propertyId) return;

    const catCol = collection(db, 'serviceCategories');
    const catQ = query(catCol, where('propertyId', '==', propertyId));
    const unsubCats = onSnapshot(catQ, (snap) => {
      const items: Category[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setCategories(items);
    });

    const svcCol = collection(db, 'services');
    const svcQ = query(svcCol, where('propertyId', '==', propertyId));
    const unsubSvcs = onSnapshot(svcQ, (snap) => {
      const items: Service[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setServices(items);
    });

    return () => {
      unsubCats();
      unsubSvcs();
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

  const createCategory = async () => {
    if (!propertyId || !canManage || !newCategoryName.trim()) return;
    try {
      const parentRef = await addDoc(collection(db, 'serviceCategories'), {
        name: newCategoryName.trim(),
        parentId: newCategoryParent || null,
        propertyId,
        createdAt: serverTimestamp()
      });

      for (const subName of newSubcategories.map(s => s.trim()).filter(Boolean)) {
        await addDoc(collection(db, 'serviceCategories'), {
          name: subName,
          parentId: parentRef.id,
          propertyId,
          createdAt: serverTimestamp()
        });
      }

      setNewCategoryName('');
      setNewCategoryParent(null);
      setNewSubcategories([]);
      setShowNewCategoryModal(false);
    } catch (e) {
      console.error('Failed to create category', e);
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      await deleteDoc(doc(db, 'services', serviceToDelete.id));
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
      setOpenDropdown(null);
    } catch (e) {
      console.error('Failed to delete service', e);
      alert('Failed to delete service. Please try again.');
    }
  };

  const handleDuplicateService = async () => {
    if (!serviceToDuplicate || !propertyId) return;
    try {
      const { id, ...serviceData } = serviceToDuplicate;
      await addDoc(collection(db, 'services'), {
        ...serviceData,
        name: `${serviceData.name} (Copy)`,
        status: 'Draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowDuplicateConfirm(false);
      setServiceToDuplicate(null);
      setOpenDropdown(null);
    } catch (e) {
      console.error('Failed to duplicate service', e);
      alert('Failed to duplicate service. Please try again.');
    }
  };

  const handleViewDetails = (service: Service) => {
    setSelectedService(service);
    setShowDetailsModal(true);
    setOpenDropdown(null);
  };

  const handleEdit = (service: Service) => {
    setServiceToEdit(service);
    setShowAddServiceModal(true);
    setOpenDropdown(null);
  };

  const updateDropdownPosition = (serviceId: string) => {
    const buttonElement = dropdownRefs.current[serviceId];
    if (!buttonElement) return;

    const rect = buttonElement.getBoundingClientRect();
    const dropdownHeight = 200; // Approximate dropdown height
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Determine if dropdown should appear above or below
    const shouldAppearAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setDropdownPosition({
      top: shouldAppearAbove ? rect.top - dropdownHeight : rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  };

  const toggleServiceStatus = async (serviceId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Draft' : 'Active';
    try {
      await updateDoc(doc(db, 'services', serviceId), { status: newStatus });
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  // Helpers
  const topCategories = categories.filter(c => !c.parentId);
  const subFor = (catId: string) => categories.filter(c => c.parentId === catId);
  
  const getCategoryName = (id?: string | null) => {
    if (!id) return '—';
    return categories.find(c => c.id === id)?.name || '—';
  };

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = !searchTerm || 
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || 
        service.categoryId === categoryFilter ||
        service.subcategoryId === categoryFilter;
      
      const matchesStatus = statusFilter === 'all' || 
        service.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [services, searchTerm, categoryFilter, statusFilter]);

  // Calculate active filters count
  const activeFiltersCount = [
    categoryFilter !== 'all' ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
  ].filter(Boolean).length;

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setShowAdvancedFilters(false);
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.permissions?.extras) {
    return (
      <div className="p-8 bg-white rounded-md border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Icons.Lock className="w-6 h-6 text-slate-400" />
          <h3 className="text-xl font-bold text-slate-900">Access Denied</h3>
        </div>
        <p className="text-sm text-slate-500">You don't have permission to manage extras and services.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Extras & Services</h1>
        </div>
        <PropertySettingsSubtabs subtabs={tabs} />
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
            All Services
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('structure')} 
            className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${
              activeTab === 'structure' 
                ? 'text-primary' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Category Structure
            {activeTab === 'structure' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-md"></div>
            )}
          </button>
        </div>
      </div>

      {/* All Services Tab */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {/* Add Service Button */}
          <div className="flex justify-start">
            <button 
              onClick={() => setShowAddServiceModal(true)} 
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icons.PlusCircle className="h-4 w-4" />
              Add Service
            </button>
          </div>

          {/* --- THE FILTER BAR --- */}
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* 1. Search Field */}
              <div className="relative flex-grow min-w-[280px]">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, description, tags..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              {/* 2. Category Filter */}
              <div className="relative">
                <Icons.Sliders className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setGroupFilter('all');
                  }}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Category</option>
                  {topCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Group Filter - Only show if category is selected and has subcategories */}
              {categoryFilter !== 'all' && subFor(categoryFilter).length > 0 && (
                <div className="relative">
                  <Icons.Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select 
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">Group</option>
                    {subFor(categoryFilter).map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4. Status Filter */}
              <div className="relative">
                <Icons.Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option>Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Draft</option>
                  <option>Archived</option>
                </select>
              </div>

              {/* 5. Visibility Filter */}
              <div className="relative">
                <Icons.Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option>Visibility</option>
                  <option>Booking Page</option>
                  <option>Guest Portal</option>
                  <option>In-App Only</option>
                </select>
              </div>

              {/* 6. Sort Options */}
              <div className="relative">
                <Icons.ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select className="appearance-none pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option>Sort by</option>
                  <option>Newest</option>
                  <option>Oldest</option>
                  <option>Top Seller</option>
                  <option>Alphabetical (A → Z)</option>
                  <option>Alphabetical (Z → A)</option>
                  <option>Price (Low → High)</option>
                  <option>Price (High → Low)</option>
                </select>
                <Icons.DropdownArrow className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              {/* 7. Clear All Button - Only show if filters are set */}
              {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all') && (
                <button 
                  onClick={handleClearAllFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-md transition-colors">
                  <Icons.X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
            
            {/* Active Filter Chips (Visual Feedback) - Only show if filters are set */}
            {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all') && (
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
                {statusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Status: {statusFilter}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Services Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-medium border-b border-slate-200 bg-slate-50/30">
                  <th className="py-3 px-4 border-r border-slate-50">Service Details</th>
                  <th className="py-3 px-4 border-r border-slate-50">Category</th>
                  <th className="py-3 px-4 border-r border-slate-50">Sub-Category</th>
                  <th className="py-3 px-4 border-r border-slate-50">Base Price</th>
                  <th className="py-3 px-4 border-r border-slate-50">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length > 0 ? (
                  filteredServices.map((service) => (
                    <tr 
                      key={service.id} 
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Service Details */}
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm font-semibold text-slate-900">{service.name}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm text-slate-700 font-medium">
                          {getCategoryName(service.categoryId)}
                        </div>
                      </td>

                      {/* Sub-Category */}
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm text-slate-600">
                          {getCategoryName(service.subcategoryId)}
                        </div>
                      </td>

                      {/* Base Price */}
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm font-semibold text-slate-900">
                          {service.currency || '$'}{service.price?.toFixed(2) || '0.00'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleServiceStatus(service.id, service.status || 'Draft')}
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              service.status === 'Active'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : service.status === 'Archived'
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              service.status === 'Active' ? 'bg-green-500' :
                              service.status === 'Archived' ? 'bg-slate-400' : 'bg-amber-500'
                            }`}></span>
                            {service.status || 'Draft'}
                          </button>
                          <div className="flex gap-1">
                            {service.bookingEngine && (
                              <div className="p-1 rounded bg-blue-50" title="Booking Engine">
                                <Icons.Globe className="w-3 h-3 text-blue-600" />
                              </div>
                            )}
                            {service.guestPortal && (
                              <div className="p-1 rounded bg-purple-50" title="Guest Portal">
                                <Icons.Smartphone className="w-3 h-3 text-purple-600" />
                              </div>
                            )}
                            {service.staffOnly && (
                              <div className="p-1 rounded bg-slate-100" title="Staff Only">
                                <Icons.Lock className="w-3 h-3 text-slate-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button 
                          ref={(el) => { dropdownRefs.current[service.id] = el; }}
                          onClick={() => {
                            if (openDropdown === service.id) {
                              setOpenDropdown(null);
                            } else {
                              setOpenDropdown(service.id);
                              updateDropdownPosition(service.id);
                            }
                          }}
                          className="p-2 hover:bg-slate-100 rounded-md transition-colors"
                          title="Actions"
                        >
                          <Icons.MoreVertical className="w-4 h-4 text-slate-600" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Icons.Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">No services found</h3>
                      <p className="text-sm text-slate-500 mb-4">
                        {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'Get started by creating your first service'}
                      </p>
                      {!searchTerm && categoryFilter === 'all' && statusFilter === 'all' && (
                        <button 
                          onClick={() => setShowAddServiceModal(true)}
                          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          Add Your First Service
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Structure Tab */}
      {activeTab === 'structure' && (
        <div>
          {/* New Category Button */}
          <div className="flex justify-start mb-4">
            <button 
              onClick={() => setShowNewCategoryModal(true)} 
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icons.Tag className="h-4 w-4" />
              New Category
            </button>
          </div>

          {/* --- THE FILTER BAR --- */}
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 space-y-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* 1. Search Field */}
              <div className="relative flex-grow min-w-[280px]">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, description, tags..."
                  value={categoryStructureSearchTerm}
                  onChange={(e) => setCategoryStructureSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              {/* 2. Category Filter */}
              <div className="relative">
                <Icons.Sliders className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryStructureCategoryFilter}
                  onChange={(e) => {
                    setCategoryStructureCategoryFilter(e.target.value);
                    setCategoryStructureGroupFilter('all');
                  }}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Category</option>
                  {topCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Group Filter - Only show if category is selected and has subcategories */}
              {categoryStructureCategoryFilter !== 'all' && subFor(categoryStructureCategoryFilter).length > 0 && (
                <div className="relative">
                  <Icons.Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select 
                    value={categoryStructureGroupFilter}
                    onChange={(e) => setCategoryStructureGroupFilter(e.target.value)}
                    className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">Group</option>
                    {subFor(categoryStructureCategoryFilter).map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4. Status Filter */}
              <div className="relative">
                <Icons.Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={categoryStructureStatusFilter}
                  onChange={(e) => setCategoryStructureStatusFilter(e.target.value)}
                  className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Draft">Draft</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              {/* 5. Visibility Filter */}
              <div className="relative">
                <Icons.Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select className="appearance-none pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option>Visibility</option>
                  <option>Booking Page</option>
                  <option>Guest Portal</option>
                  <option>In-App Only</option>
                </select>
              </div>

              {/* 6. Sort Options */}
              <div className="relative">
                <Icons.ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select className="appearance-none pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option>Sort by</option>
                  <option>Newest</option>
                  <option>Oldest</option>
                  <option>Top Seller</option>
                  <option>Alphabetical (A → Z)</option>
                  <option>Alphabetical (Z → A)</option>
                  <option>Price (Low → High)</option>
                  <option>Price (High → Low)</option>
                </select>
                <Icons.DropdownArrow className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              {/* 7. Clear All Button - Only show if filters are set */}
              {(categoryStructureSearchTerm || categoryStructureCategoryFilter !== 'all' || categoryStructureStatusFilter !== 'all') && (
                <button 
                  onClick={() => {
                    setCategoryStructureSearchTerm('');
                    setCategoryStructureCategoryFilter('all');
                    setCategoryStructureStatusFilter('all');
                    setCategoryStructureGroupFilter('all');
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-md transition-colors">
                  <Icons.X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
            
            {/* Active Filter Chips (Visual Feedback) - Only show if filters are set */}
            {(categoryStructureSearchTerm || categoryStructureCategoryFilter !== 'all' || categoryStructureStatusFilter !== 'all') && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider py-1">Active Filters:</span>
                {categoryStructureSearchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Search: {categoryStructureSearchTerm}
                  </span>
                )}
                {categoryStructureCategoryFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Category: {getCategoryName(categoryStructureCategoryFilter)}
                  </span>
                )}
                {categoryStructureStatusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Status: {categoryStructureStatusFilter}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-md border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Category Hierarchy</h3>
                <p className="text-sm text-slate-500 mt-1">Organize your services into categories and sub-categories</p>
              </div>
            </div>
            
            <div className="space-y-4">
            {topCategories.length > 0 ? (
              topCategories.map(tc => (
                <div key={tc.id} className="bg-slate-50 rounded-md border border-slate-200 overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Icons.Tag className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{tc.name}</div>
                        <div className="text-xs text-slate-500">
                          {subFor(tc.id).length} sub-{subFor(tc.id).length === 1 ? 'category' : 'categories'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {services.filter(s => s.categoryId === tc.id).length} services
                      </span>
                    </div>
                  </div>
                  
                  {subFor(tc.id).length > 0 && (
                    <div className="border-t border-slate-200 bg-white">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
                        {subFor(tc.id).map(sc => (
                          <div key={sc.id} className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-200">
                            <Icons.ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-700 truncate">{sc.name}</span>
                            <span className="ml-auto text-xs text-slate-400">
                              {services.filter(s => s.subcategoryId === sc.id).length}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Icons.Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-semibold text-slate-900 mb-1">No categories yet</h4>
                <p className="text-sm text-slate-500 mb-4">Create your first category to organize services</p>
                <button 
                  onClick={() => setShowNewCategoryModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Create Category
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-md w-full max-w-2xl p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Icons.Tag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">New Category</h3>
                  <p className="text-sm text-slate-500">Create a new service category</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewCategoryModal(false)} 
                className="p-2 rounded-md hover:bg-slate-100 transition-colors"
              >
                <Icons.Close className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Category Name</label>
                <input 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="e.g., Wellness, Excursions, Transfers"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Category (Optional)</label>
                <select 
                  value={newCategoryParent || ''} 
                  onChange={e => setNewCategoryParent(e.target.value || null)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                >
                  <option value="">Top-level category</option>
                  {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Sub-categories</label>
                <div className="space-y-2">
                  {newSubcategories.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        value={s} 
                        onChange={e => setNewSubcategories(prev => prev.map((v,i) => i===idx?e.target.value:v))} 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none" 
                        placeholder={`Sub-category ${idx+1}`} 
                      />
                      <button 
                        onClick={() => setNewSubcategories(prev => prev.filter((_,i)=>i!==idx))} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Icons.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setNewSubcategories(prev => [...prev, ''])} 
                    className="w-full px-4 py-2 border border-dashed border-slate-300 rounded-md text-sm text-slate-600 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.PlusCircle className="w-4 h-4" />
                    Add Sub-category
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
              <button 
                onClick={() => setShowNewCategoryModal(false)} 
                className="px-5 py-2.5 rounded-md border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={createCategory} 
                disabled={!newCategoryName.trim()}
                className="px-5 py-2.5 rounded-md bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icons.CheckCircle2 className="w-4 h-4" />
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddServiceModal && propertyId && (
        <AddServiceForm
          propertyId={propertyId}
          onClose={() => {
            setShowAddServiceModal(false);
            setServiceToEdit(null);
          }}
          onSuccess={() => {
            setServiceToEdit(null);
          }}
          serviceToEdit={serviceToEdit || undefined}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && serviceToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Icons.AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Service</h3>
                <p className="text-sm text-slate-600 mb-1">
                  Are you sure you want to delete <span className="font-semibold text-slate-900">{serviceToDelete.name}</span>?
                </p>
                <p className="text-sm text-red-600">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setServiceToDelete(null);
                }}
                className="px-5 py-2.5 rounded-md border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteService();
                }}
                className="px-5 py-2.5 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Icons.Trash className="w-4 h-4" />
                Delete Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDuplicateConfirm && serviceToDuplicate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icons.Copy className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Duplicate Service</h3>
                <p className="text-sm text-slate-600 mb-1">
                  Create a copy of <span className="font-semibold text-slate-900">{serviceToDuplicate.name}</span>?
                </p>
                <p className="text-sm text-slate-500">
                  The new service will be created as a Draft and named "{serviceToDuplicate.name} (Copy)".
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  setServiceToDuplicate(null);
                }}
                className="px-5 py-2.5 rounded-md border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDuplicateService();
                }}
                className="px-5 py-2.5 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Icons.Copy className="w-4 h-4" />
                Duplicate Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Details Modal */}
      {showDetailsModal && selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          categoryName={getCategoryName(selectedService.categoryId)}
          subcategoryName={getCategoryName(selectedService.subcategoryId)}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedService(null);
          }}
          onEdit={() => {
            setShowDetailsModal(false);
            handleEdit(selectedService);
          }}
          onDuplicate={() => {
            setShowDetailsModal(false);
            setServiceToDuplicate(selectedService);
            setShowDuplicateConfirm(true);
          }}
          onDelete={() => {
            setShowDetailsModal(false);
            setServiceToDelete(selectedService);
            setShowDeleteConfirm(true);
          }}
        />
      )}

      {/* Dropdown Menu Portal */}
      {openDropdown && dropdownPosition && typeof window !== 'undefined' && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setOpenDropdown(null)}
          />
          <div 
            className="fixed z-[101] w-48 bg-white rounded-md shadow-xl border border-slate-200 py-1"
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            }}
          >
            {filteredServices.find(s => s.id === openDropdown) && (
              <>
                <button
                  onClick={() => {
                    const service = filteredServices.find(s => s.id === openDropdown);
                    if (service) handleViewDetails(service);
                    setOpenDropdown(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Icons.Eye className="w-4 h-4" />
                  View Details
                </button>
                <button
                  onClick={() => {
                    const service = filteredServices.find(s => s.id === openDropdown);
                    if (service) handleEdit(service);
                    setOpenDropdown(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Icons.Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    const service = filteredServices.find(s => s.id === openDropdown);
                    if (service) {
                      setServiceToDuplicate(service);
                      setShowDuplicateConfirm(true);
                    }
                    setOpenDropdown(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Icons.Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <div className="border-t border-slate-200 my-1" />
                <button
                  onClick={() => {
                    const service = filteredServices.find(s => s.id === openDropdown);
                    if (service) {
                      setServiceToDelete(service);
                      setShowDeleteConfirm(true);
                    }
                    setOpenDropdown(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Icons.Trash className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
