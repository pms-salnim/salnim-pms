"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Icons } from '@/components/icons';
import AddPackageForm from '@/components/extras/add-package-form';
import PackageDetailsModal from '@/components/extras/package-details-modal';
import type { Package } from '@/types/package';

type RoomType = {
  id: string;
  name: string;
};

type Service = {
  id: string;
  name: string;
};

type MealPlan = {
  id: string;
  name: string;
};

export default function PackagesPage() {
  const { user, isLoadingAuth } = useAuth();
  const propertyId = user?.propertyId || null;
  const canManage = !!user?.permissions?.extras;

  const [packages, setPackages] = useState<Package[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  
  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from?: Date; to?: Date }>({});

  // Modals
  const [showAddPackageModal, setShowAddPackageModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [packageToDuplicate, setPackageToDuplicate] = useState<Package | null>(null);
  const [packageToEdit, setPackageToEdit] = useState<Package | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; right?: number } | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    if (!propertyId) return;

    const pkgCol = collection(db, 'packages');
    const pkgQ = query(pkgCol, where('propertyId', '==', propertyId));
    const unsubPkgs = onSnapshot(pkgQ, (snap) => {
      const items: Package[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setPackages(items);
    });

    const rtCol = collection(db, 'roomTypes');
    const rtQ = query(rtCol, where('propertyId', '==', propertyId));
    const unsubRT = onSnapshot(rtQ, (snap) => {
      const items: RoomType[] = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      setRoomTypes(items);
    });

    const svcCol = collection(db, 'services');
    const svcQ = query(svcCol, where('propertyId', '==', propertyId));
    const unsubSvc = onSnapshot(svcQ, (snap) => {
      const items: Service[] = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      setServices(items);
    });

    const mealCol = collection(db, 'mealPlans');
    const mealQ = query(mealCol, where('propertyId', '==', propertyId));
    const unsubMeal = onSnapshot(mealQ, (snap) => {
      const items: MealPlan[] = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      setMealPlans(items);
    });

    return () => {
      unsubPkgs();
      unsubRT();
      unsubSvc();
      unsubMeal();
    };
  }, [propertyId]);

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

  const updateDropdownPosition = (packageId: string) => {
    const buttonEl = dropdownRefs.current[packageId];
    if (!buttonEl) return;

    const rect = buttonEl.getBoundingClientRect();
    const dropdownHeight = 200;
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

  const toggleDropdown = (packageId: string) => {
    if (openDropdown === packageId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else {
      setOpenDropdown(packageId);
      updateDropdownPosition(packageId);
    }
  };

  const handleView = (pkg: Package) => {
    setSelectedPackage(pkg);
    setShowDetailsModal(true);
    setOpenDropdown(null);
  };

  const handleEdit = (pkg: Package) => {
    setPackageToEdit(pkg);
    setShowAddPackageModal(true);
    setOpenDropdown(null);
  };

  const handleDuplicate = (pkg: Package) => {
    setPackageToDuplicate(pkg);
    setShowDuplicateConfirm(true);
    setOpenDropdown(null);
  };

  const handleDelete = (pkg: Package) => {
    setPackageToDelete(pkg);
    setShowDeleteConfirm(true);
    setOpenDropdown(null);
  };

  const confirmDuplicate = async () => {
    if (!packageToDuplicate || !propertyId) return;
    
    try {
      const { id, createdAt, updatedAt, ...pkgData } = packageToDuplicate as any;
      const newPkg = {
        ...pkgData,
        name: `${pkgData.name} (Copy)`,
        status: 'Draft',
        createdAt: new Date(),
      };
      
      await addDoc(collection(db, 'packages'), newPkg);
      setShowDuplicateConfirm(false);
      setPackageToDuplicate(null);
    } catch (error) {
      console.error('Error duplicating package:', error);
    }
  };

  const confirmDelete = async () => {
    if (!packageToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'packages', packageToDelete.id));
      setShowDeleteConfirm(false);
      setPackageToDelete(null);
    } catch (error) {
      console.error('Error deleting package:', error);
    }
  };

  const toggleStatus = async (pkg: Package) => {
    try {
      const newStatus = pkg.status === 'Active' ? 'Draft' : 'Active';
      await updateDoc(doc(db, 'packages', pkg.id), {
        status: newStatus,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating package status:', error);
    }
  };

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || pkg.packageCategory === categoryFilter;
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      const matchesVisibility = visibilityFilter === 'all' || 
        (visibilityFilter === 'booking' && pkg.visibleOnBooking) ||
        (visibilityFilter === 'portal' && pkg.visibleInGuestPortal);
      
      let matchesDateRange = true;
      if (dateRangeFilter.from && pkg.validFrom) {
        matchesDateRange = pkg.validFrom.toDate() >= dateRangeFilter.from;
      }
      if (dateRangeFilter.to && pkg.validTo) {
        matchesDateRange = matchesDateRange && pkg.validTo.toDate() <= dateRangeFilter.to;
      }
      
      return matchesSearch && matchesCategory && matchesStatus && matchesVisibility && matchesDateRange;
    });
  }, [packages, searchTerm, categoryFilter, statusFilter, visibilityFilter, dateRangeFilter]);

  const getIncludedItemsSummary = (pkg: Package) => {
    const items = [];
    if (pkg.applicableRoomTypes && pkg.applicableRoomTypes.length > 0) {
      items.push(`${pkg.applicableRoomTypes.length} room type(s)`);
    }
    if (pkg.includedMealPlanId) {
      items.push('Meal plan');
    }
    if (pkg.includedServices && pkg.includedServices.length > 0) {
      items.push(`${pkg.includedServices.length} service(s)`);
    }
    return items.join(', ') || 'None';
  };

  const getPricingTypeLabel = (type: string) => {
    switch (type) {
      case 'fixed_price': return 'Fixed Price';
      case 'discounted_bundle': return 'Discounted Bundle';
      case 'per_night_surcharge': return 'Per Night Surcharge';
      default: return type;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'stay_package': return 'Stay Package';
      case 'experience_package': return 'Experience Package';
      case 'seasonal_offer': return 'Seasonal Offer';
      case 'custom': return 'Custom';
      default: return category;
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !propertyId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Icons.Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Property Selected</h3>
          <p className="text-sm text-muted-foreground">Please select a property to view packages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Packages</h1>
            <p className="text-sm text-muted-foreground">
              Create bundled offers combining rooms, services & meal plans
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setPackageToEdit(null);
                setShowAddPackageModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Icons.PlusCircle className="h-4 w-4" />
              Add Package
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="border-b bg-muted/30 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Categories</option>
            <option value="stay_package">Stay Package</option>
            <option value="experience_package">Experience Package</option>
            <option value="seasonal_offer">Seasonal Offer</option>
            <option value="custom">Custom</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
          </select>

          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Visibility</option>
            <option value="booking">Booking Page</option>
            <option value="portal">Guest Portal</option>
          </select>

          {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || visibilityFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setVisibilityFilter('all');
                setDateRangeFilter({});
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {/* Packages List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredPackages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Icons.Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No packages found</h3>
              <p className="text-sm text-muted-foreground">
                {packages.length === 0
                  ? 'Get started by creating your first package'
                  : 'Try adjusting your filters'}
              </p>
              {canManage && packages.length === 0 && (
                <button
                  onClick={() => {
                    setPackageToEdit(null);
                    setShowAddPackageModal(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Icons.PlusCircle className="h-4 w-4" />
                  Add Your First Package
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Package Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Included Items
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pricing
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Visibility
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Validity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {pkg.images && pkg.images.length > 0 ? (
                          <img
                            src={pkg.images[0]}
                            alt={pkg.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                            <Icons.Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{pkg.name}</div>
                          {pkg.shortDescription && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {pkg.shortDescription}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {getCategoryLabel(pkg.packageCategory)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {getIncludedItemsSummary(pkg)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium">${pkg.packagePrice}</div>
                        <div className="text-xs text-muted-foreground">
                          {getPricingTypeLabel(pkg.pricingType)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {pkg.visibleOnBooking && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Icons.Globe className="h-3 w-3" />
                            Booking
                          </span>
                        )}
                        {pkg.visibleInGuestPortal && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Icons.Users className="h-3 w-3" />
                            Portal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {pkg.validFrom && pkg.validTo ? (
                        <div>
                          {pkg.validFrom.toDate().toLocaleDateString()} -{' '}
                          {pkg.validTo.toDate().toLocaleDateString()}
                        </div>
                      ) : (
                        'Always'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          pkg.status === 'Active'
                            ? 'bg-green-50 text-green-700'
                            : pkg.status === 'Draft'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          ref={(el) => {
                            dropdownRefs.current[pkg.id] = el;
                          }}
                          onClick={() => toggleDropdown(pkg.id)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          <Icons.MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dropdown Menu Portal */}
      {openDropdown && dropdownPosition && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpenDropdown(null);
              setDropdownPosition(null);
            }}
          />
          <div
            className="fixed z-50 w-48 rounded-md border bg-popover p-1 shadow-md"
            style={{
              top: `${dropdownPosition.top}px`,
              left: dropdownPosition.right ? 'auto' : `${dropdownPosition.left}px`,
              right: dropdownPosition.right ? `${dropdownPosition.right}px` : 'auto',
            }}
          >
            {(() => {
              const pkg = packages.find(p => p.id === openDropdown);
              if (!pkg) return null;
              
              return (
                <>
                  <button
                    onClick={() => handleView(pkg)}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
                  >
                    <Icons.Eye className="h-4 w-4" />
                    View Details
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
                      >
                        <Icons.Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(pkg)}
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
                      >
                        <Icons.Copy className="h-4 w-4" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => toggleStatus(pkg)}
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
                      >
                        {pkg.status === 'Active' ? (
                          <>
                            <Icons.Archive className="h-4 w-4" />
                            Set as Draft
                          </>
                        ) : (
                          <>
                            <Icons.CheckCircle2 className="h-4 w-4" />
                            Set as Active
                          </>
                        )}
                      </button>
                      <div className="my-1 h-px bg-border" />
                      <button
                        onClick={() => handleDelete(pkg)}
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <Icons.Trash className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* Add/Edit Package Modal */}
      {showAddPackageModal && (
        <AddPackageForm
          isOpen={showAddPackageModal}
          onClose={() => {
            setShowAddPackageModal(false);
            setPackageToEdit(null);
          }}
          package={packageToEdit}
          propertyId={propertyId}
          roomTypes={roomTypes}
          services={services}
          mealPlans={mealPlans}
        />
      )}

      {/* Package Details Modal */}
      {showDetailsModal && selectedPackage && (
        <PackageDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPackage(null);
          }}
          package={selectedPackage}
          roomTypes={roomTypes}
          services={services}
          mealPlans={mealPlans}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Delete Package</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete "{packageToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPackageToDelete(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Duplicate Confirmation */}
      {showDuplicateConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Duplicate Package</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a copy of "{packageToDuplicate?.name}"? The copy will be created as a draft.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  setPackageToDuplicate(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDuplicate}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
