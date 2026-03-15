"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Icons } from '@/components/icons';
import AddServiceForm from '@/components/extras/add-service-form';
import ServiceDetailsModal from '@/components/extras/service-details-modal';

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

export default function ServicesPage() {
  const { user, isLoadingAuth } = useAuth();
  const propertyId = user?.propertyId || null;
  const canManage = !!user?.permissions?.extras;

  const [activeTab, setActiveTab] = useState<'all' | 'structure'>('all');
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.permissions?.extras) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Icons.Lock className="w-6 h-6 text-slate-400" />
          <h3 className="text-xl font-bold text-slate-900">Access Denied</h3>
        </div>
        <p className="text-sm text-slate-500">You don't have permission to manage extras and services.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Extras & Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your property's service catalog and upsells</p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-slate-600">{services.length} Total Services</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-slate-600">{services.filter(s => s.status === 'Active').length} Active</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-slate-300"></div>
              <span className="text-slate-600">{topCategories.length} Categories</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNewCategoryModal(true)} 
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Icons.Tag className="w-4 h-4" />
            New Category
          </button>
          <button 
            onClick={() => setShowAddServiceModal(true)} 
            className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <Icons.PlusCircle className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
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
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
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
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
            )}
          </button>
        </div>
      </div>

      {/* All Services Tab */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search services by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
              
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              >
                <option value="all">All Categories</option>
                {topCategories.map(cat => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>{cat.name}</option>
                    {subFor(cat.id).map(sub => (
                      <option key={sub.id} value={sub.id}>— {sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Services Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200">
              <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <div className="col-span-4">Service Details</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Sub-Category</div>
                <div className="col-span-1">Base Price</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {filteredServices.length > 0 ? (
                filteredServices.map((service) => (
                  <div 
                    key={service.id} 
                    className="px-6 py-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Service Details */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {service.featuredImage ? (
                            <img src={service.featuredImage} alt={service.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-primary">
                              {service.name[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">{service.name}</div>
                          <div className="text-xs text-slate-500 truncate">{service.description || 'No description'}</div>
                          {service.tags && service.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {service.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                                  {tag}
                                </span>
                              ))}
                              {service.tags.length > 2 && (
                                <span className="text-[10px] text-slate-400">+{service.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Category */}
                      <div className="col-span-2">
                        <div className="text-sm text-slate-700 font-medium">
                          {getCategoryName(service.categoryId)}
                        </div>
                      </div>

                      {/* Sub-Category */}
                      <div className="col-span-2">
                        <div className="text-sm text-slate-600">
                          {getCategoryName(service.subcategoryId)}
                        </div>
                      </div>

                      {/* Base Price */}
                      <div className="col-span-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {service.currency || '$'}{service.price?.toFixed(2) || '0.00'}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleServiceStatus(service.id, service.status || 'Draft')}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
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
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex items-center justify-end">
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
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Actions"
                        >
                          <Icons.MoreVertical className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center">
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
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Add Your First Service
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Structure Tab */}
      {activeTab === 'structure' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Category Hierarchy</h3>
              <p className="text-sm text-slate-500 mt-1">Organize your services into categories and sub-categories</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {topCategories.length > 0 ? (
              topCategories.map(tc => (
                <div key={tc.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
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
                          <div key={sc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
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
                  className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Create Category
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl w-full max-w-2xl p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icons.Tag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">New Category</h3>
                  <p className="text-sm text-slate-500">Create a new service category</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewCategoryModal(false)} 
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parent Category (Optional)</label>
                <select 
                  value={newCategoryParent || ''} 
                  onChange={e => setNewCategoryParent(e.target.value || null)} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
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
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" 
                        placeholder={`Sub-category ${idx+1}`} 
                      />
                      <button 
                        onClick={() => setNewSubcategories(prev => prev.filter((_,i)=>i!==idx))} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Icons.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setNewSubcategories(prev => [...prev, ''])} 
                    className="w-full px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
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
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={createCategory} 
                disabled={!newCategoryName.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
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
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteService();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
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
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDuplicateService();
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
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
            className="fixed z-[101] w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1"
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
