
"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Icons } from '@/components/icons';
import AddServiceForm from '@/components/extras/add-service-form';

/*
  Refactored Extras & Services page
  - Uses global CSS / Tailwind utility classes only (no custom colors/fonts)
  - Two horizontal tabs: All Services, Structure & Categories
  - Can create categories, sub-categories, and services
  - Minimal, self-contained UI using Firestore collections:
      - services (existing)
      - serviceCategories (new) fields: { name, parentId|null, propertyId, createdAt }
*/

type Category = { id: string; name: string; parentId?: string | null };
type Service = { id: string; name: string; description?: string; price?: number; currency?: string; categoryId?: string | null; subcategoryId?: string | null };

export default function ServicesPage() {
  const { user, isLoadingAuth } = useAuth();
  const propertyId = user?.propertyId || null;
  const canManage = !!user?.permissions?.extras;

  const [activeTab, setActiveTab] = useState<'all' | 'structure'>('all');

  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form state for category
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string | null>(null);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);

  // dynamic subcategories in modal
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

  const createCategory = async () => {
    if (!propertyId || !canManage || !newCategoryName.trim()) return;
    try {
      // create parent category
      const parentRef = await addDoc(collection(db, 'serviceCategories'), {
        name: newCategoryName.trim(),
        parentId: newCategoryParent || null,
        propertyId,
        createdAt: serverTimestamp()
      });

      // create subcategories pointing to parent
      for (const subName of newSubcategories.map(s => s.trim()).filter(Boolean)) {
        await addDoc(collection(db, 'serviceCategories'), {
          name: subName,
          parentId: parentRef.id,
          propertyId,
          createdAt: serverTimestamp()
        });
      }

      // reset modal state
      setNewCategoryName('');
      setNewCategoryParent(null);
      setNewSubcategories([]);
      setShowNewCategoryModal(false);
    } catch (e) {
      console.error('Failed to create category', e);
    }
  };

  // service creation handled elsewhere; inline creation removed per design

  // Helpers to build category tree
  const topCategories = categories.filter(c => !c.parentId);
  const subFor = (catId: string) => categories.filter(c => c.parentId === catId);

  if (isLoadingAuth) return <div className="flex items-center justify-center h-48"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>;

  if (!user?.permissions?.extras) return (
    <div className="p-6 bg-white rounded-md border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold">Access denied</h3>
      <p className="text-sm text-slate-500">You don't have permission to manage extras.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Extras & Services</h1>
          <p className="text-sm text-slate-500">Manage your catalog, categories, and dynamic upsells.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAddServiceModal(true)} className="px-4 py-2 rounded-full bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
            <Icons.PlusCircle className="w-4 h-4" />
            Add Service
          </button>
          <button onClick={() => setShowNewCategoryModal(true)} className="px-4 py-2 rounded-full border bg-white hover:bg-slate-50 transition-colors">New Category</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-md p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6 mb-6">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-md ${activeTab === 'all' ? 'bg-slate-100 font-semibold' : 'bg-white'}`}>All Services</button>
          <button onClick={() => setActiveTab('structure')} className={`px-4 py-2 rounded-md ${activeTab === 'structure' ? 'bg-slate-100 font-semibold' : 'bg-white'}`}>Structure & Categories</button>
        </div>

        {activeTab === 'all' ? (
          <div>
            {/* Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <input placeholder="Search services..." className="col-span-1 md:col-span-2 p-3 border rounded-xl" />
            </div>

            {/* Services list */}
            <div className="rounded-md border overflow-hidden">
              <div className="p-4 bg-white">
                <div className="grid grid-cols-6 gap-4 text-xs text-slate-500 uppercase font-medium">
                  <div className="col-span-3">Service Details</div>
                  <div>Category</div>
                  <div>Sub-Category</div>
                  <div>Base Price</div>
                </div>
              </div>
              <div>
                {services.map(s => (
                  <div key={s.id} className="p-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">{s.name[0]?.toUpperCase()}</div>
                      <div>
                        <div className="font-bold">{s.name}</div>
                        <div className="text-sm text-slate-500">{s.description}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">{categories.find(c => c.id === s.categoryId)?.name || '—'}</div>
                    <div className="text-sm text-slate-600">{categories.find(c => c.id === s.subcategoryId)?.name || '—'}</div>
                    <div className="font-bold">{s.currency || '$'}{s.price ?? 0}</div>
                  </div>
                ))}
                {services.length === 0 && <div className="p-6 text-center text-slate-500">No services yet</div>}
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Category Structure (creation via modal only) */}
            <div className="col-span-3 p-4 border rounded-md">
              <h4 className="font-bold mb-2">Category Structure</h4>
              <div className="space-y-3">
                {topCategories.map(tc => (
                  <div key={tc.id} className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{tc.name}</div>
                      <div className="text-sm text-slate-500">{subFor(tc.id).length} sub-categories</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {subFor(tc.id).map(sc => (
                        <div key={sc.id} className="pl-4 text-sm text-slate-600">— {sc.name}</div>
                      ))}
                    </div>
                  </div>
                ))}
                {topCategories.length === 0 && <div className="text-slate-500">No categories yet</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewCategoryModal(false)} />
          <div className="relative bg-white rounded-md w-full max-w-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">New Category</h3>
              <button onClick={() => setShowNewCategoryModal(false)} className="p-2 rounded hover:bg-slate-100"><Icons.Close className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600">Category name</label>
                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-2 border rounded mt-1" />
              </div>
              <div>
                <label className="text-sm text-slate-600">Parent category (optional)</label>
                <select value={newCategoryParent || ''} onChange={e => setNewCategoryParent(e.target.value || null)} className="w-full p-2 border rounded mt-1">
                  <option value="">Top-level category</option>
                  {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Sub-categories</label>
                <div className="space-y-2 mt-2">
                  {newSubcategories.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={s} onChange={e => setNewSubcategories(prev => prev.map((v,i) => i===idx?e.target.value:v))} className="flex-1 p-2 border rounded" placeholder={`Sub-category ${idx+1}`} />
                      <button onClick={() => setNewSubcategories(prev => prev.filter((_,i)=>i!==idx))} className="p-2 rounded border">Remove</button>
                    </div>
                  ))}
                  <button onClick={() => setNewSubcategories(prev => [...prev, ''])} className="mt-2 px-3 py-2 rounded border">Add sub-category</button>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowNewCategoryModal(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button onClick={createCategory} className="px-4 py-2 rounded bg-white border">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddServiceModal && propertyId && (
        <AddServiceForm
          propertyId={propertyId}
          onClose={() => setShowAddServiceModal(false)}
          onSuccess={() => {
            // Services list will update automatically via onSnapshot listener
          }}
        />
      )}
    </div>
  );
}
