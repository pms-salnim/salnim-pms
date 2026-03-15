"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  addDoc,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  AlertTriangle,
  Box,
  DollarSign,
  Plus,
  Edit,
  AlertOctagon,
  Zap,
  TrendingDown,
  Package,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property';

interface InventoryItem {
  id: string;
  propertyId: string;
  name: string;
  category: 'Cleaning Supplies' | 'Toiletries' | 'Linens' | 'Amenities' | 'Other';
  unit: string; // e.g., 'bottles', 'rolls', 'sets', 'bars'
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  unitCost: number;
  supplier?: string;
  reorderQuantity: number;
  lastRestocked: Timestamp;
  usagePerRoom?: number; // consumption rate per room per day
  notes?: string;
  createdAt: Timestamp;
}

interface StockCount {
  id: string;
  propertyId: string;
  itemId: string;
  itemName: string;
  systemCount: number;
  physicalCount: number;
  countedAt: Timestamp;
  countedBy: string;
  discrepancy: number; // physicalCount - systemCount
  notes?: string;
}

interface ReorderRequest {
  id: string;
  propertyId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  supplier?: string;
  status: 'pending' | 'ordered' | 'delivered';
  createdAt: Timestamp;
  deliveredAt?: Timestamp;
  cost?: number;
}

const inventoryCategories = ['Cleaning Supplies', 'Toiletries', 'Linens', 'Amenities', 'Other'] as const;

export default function InventoryManagementPage() {
  const { user, isLoadingAuth } = useAuth();

  // State
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [reorders, setReorders] = useState<ReorderRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all');

  // Tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'counts' | 'reorders'>('inventory');

  // Modals
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<typeof inventoryCategories[0]>('Cleaning Supplies');
  const [editUnit, setEditUnit] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editMinLevel, setEditMinLevel] = useState('');
  const [editMaxLevel, setEditMaxLevel] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editReorderQty, setEditReorderQty] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Count form
  const [countPhysical, setCountPhysical] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [isCountingSubmitting, setIsCountingSubmitting] = useState(false);

  // Reorder form
  const [reorderQty, setReorderQty] = useState('');
  const [reorderSupplier, setReorderSupplier] = useState('');
  const [isReorderSubmitting, setIsReorderSubmitting] = useState(false);

  const canManage = user?.permissions?.housekeeping;

  // Get property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Fetch property settings
  useEffect(() => {
    if (!propertyId) return;

    const propDocRef = doc(db, 'properties', propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      setPropertySettings(docSnap.exists() ? (docSnap.data() as Property) : null);
    });

    return () => unsubProp();
  }, [propertyId]);

  // Fetch inventory items
  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const itemsQuery = query(
      collection(db, 'inventoryItems'),
      where('propertyId', '==', propertyId),
      orderBy('category', 'asc')
    );

    const unsubItems = onSnapshot(itemsQuery, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as InventoryItem));
      setInventoryItems(items);
      setIsLoading(false);
    });

    return () => unsubItems();
  }, [propertyId]);

  // Fetch stock counts
  useEffect(() => {
    if (!propertyId) return;

    const countsQuery = query(
      collection(db, 'stockCounts'),
      where('propertyId', '==', propertyId),
      orderBy('countedAt', 'desc')
    );

    const unsubCounts = onSnapshot(countsQuery, (snapshot) => {
      const counts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as StockCount));
      setStockCounts(counts);
    });

    return () => unsubCounts();
  }, [propertyId]);

  // Fetch reorders
  useEffect(() => {
    if (!propertyId) return;

    const reordersQuery = query(
      collection(db, 'reorderRequests'),
      where('propertyId', '==', propertyId),
      orderBy('createdAt', 'desc')
    );

    const unsubReorders = onSnapshot(reordersQuery, (snapshot) => {
      const orders = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as ReorderRequest));
      setReorders(orders);
    });

    return () => unsubReorders();
  }, [propertyId]);

  // Filter inventory items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      // Search
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Stock status filter
      if (stockStatusFilter !== 'all') {
        if (stockStatusFilter === 'low' && item.currentStock > item.minStockLevel) return false;
        if (stockStatusFilter === 'normal' && (item.currentStock <= item.minStockLevel || item.currentStock >= item.maxStockLevel)) return false;
        if (stockStatusFilter === 'high' && item.currentStock < item.maxStockLevel) return false;
      }

      return true;
    });
  }, [inventoryItems, searchQuery, categoryFilter, stockStatusFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const lowStock = inventoryItems.filter((i) => i.currentStock <= i.minStockLevel).length;
    const highStock = inventoryItems.filter((i) => i.currentStock >= i.maxStockLevel).length;
    const totalValue = inventoryItems.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0);
    const pendingReorders = reorders.filter((r) => r.status === 'pending' || r.status === 'ordered').length;

    return { lowStock, highStock, totalValue, pendingReorders, totalItems: inventoryItems.length };
  }, [inventoryItems, reorders]);

  const handleOpenEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditUnit(item.unit);
    setEditStock(item.currentStock.toString());
    setEditMinLevel(item.minStockLevel.toString());
    setEditMaxLevel(item.maxStockLevel.toString());
    setEditCost(item.unitCost.toString());
    setEditReorderQty(item.reorderQuantity.toString());
    setIsEditModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!selectedItem) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'inventoryItems', selectedItem.id), {
        name: editName,
        category: editCategory,
        unit: editUnit,
        currentStock: parseFloat(editStock),
        minStockLevel: parseFloat(editMinLevel),
        maxStockLevel: parseFloat(editMaxLevel),
        unitCost: parseFloat(editCost),
        reorderQuantity: parseFloat(editReorderQty),
      });

      toast({ title: 'Success', description: 'Inventory item updated' });
      setIsEditModalOpen(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCountStock = async () => {
    if (!selectedItem || !countPhysical) return;

    setIsCountingSubmitting(true);
    try {
      const discrepancy = parseFloat(countPhysical) - selectedItem.currentStock;

      // Create stock count record
      await addDoc(collection(db, 'stockCounts'), {
        propertyId,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        systemCount: selectedItem.currentStock,
        physicalCount: parseFloat(countPhysical),
        discrepancy,
        countedAt: Timestamp.now(),
        countedBy: user?.id,
        notes: countNotes,
      });

      // Update inventory item
      await updateDoc(doc(db, 'inventoryItems', selectedItem.id), {
        currentStock: parseFloat(countPhysical),
        lastRestocked: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Stock count recorded' });
      setIsCountModalOpen(false);
      setSelectedItem(null);
      setCountPhysical('');
      setCountNotes('');
    } catch (error) {
      console.error('Error counting stock:', error);
      toast({ title: 'Error', description: 'Failed to record count', variant: 'destructive' });
    } finally {
      setIsCountingSubmitting(false);
    }
  };

  const handleCreateReorder = async () => {
    if (!selectedItem || !reorderQty) return;

    setIsReorderSubmitting(true);
    try {
      await addDoc(collection(db, 'reorderRequests'), {
        propertyId,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: parseFloat(reorderQty),
        supplier: reorderSupplier || selectedItem.supplier,
        status: 'pending',
        createdAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Reorder request created' });
      setIsReorderModalOpen(false);
      setSelectedItem(null);
      setReorderQty('');
      setReorderSupplier('');
    } catch (error) {
      console.error('Error creating reorder:', error);
      toast({ title: 'Error', description: 'Failed to create reorder', variant: 'destructive' });
    } finally {
      setIsReorderSubmitting(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= item.minStockLevel) {
      return { status: 'low', color: 'text-red-600 bg-red-50', icon: AlertTriangle };
    }
    if (item.currentStock >= item.maxStockLevel) {
      return { status: 'high', color: 'text-amber-600 bg-amber-50', icon: AlertOctagon };
    }
    return { status: 'normal', color: 'text-emerald-600 bg-emerald-50', icon: Zap };
  };

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>You do not have permission to access inventory management.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Linen & Inventory Management</h1>
          <p className="text-slate-600 mt-2">Track stock levels, manage reorders, and monitor costs</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Items</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.totalItems}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <Box size={18} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Low Stock</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.lowStock}</h3>
              <p className="text-[10px] font-medium text-red-600 mt-1">Below minimum</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">High Stock</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.highStock}</h3>
              <p className="text-[10px] font-medium text-amber-600 mt-1">Above maximum</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertOctagon size={18} className="text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Reorders</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.pendingReorders}</h3>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <Package size={18} className="text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Value</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">${kpis.totalValue.toFixed(0)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <DollarSign size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('inventory')}
          className={cn(
            'px-4 py-2 font-medium text-sm border-b-2 -mb-[2px] transition-colors',
            activeTab === 'inventory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab('counts')}
          className={cn(
            'px-4 py-2 font-medium text-sm border-b-2 -mb-[2px] transition-colors',
            activeTab === 'counts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          Stock Counts
        </button>
        <button
          onClick={() => setActiveTab('reorders')}
          className={cn(
            'px-4 py-2 font-medium text-sm border-b-2 -mb-[2px] transition-colors',
            activeTab === 'reorders'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          )}
        >
          Reorders
        </button>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex gap-4 items-center flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {inventoryCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Stock Status Filter */}
              <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <Box className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No items found</h3>
                <p className="text-slate-600">Adjust your filters or create new items</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const statusInfo = getStockStatus(item);
                const Icon = statusInfo.icon;
                return (
                  <div key={item.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                            <Badge className={cn('gap-1', statusInfo.color)}>
                              <Icon size={12} />
                              {statusInfo.status.charAt(0).toUpperCase() + statusInfo.status.slice(1)}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-slate-600">Current Stock</p>
                              <p className="text-lg font-bold text-slate-900">
                                {item.currentStock} {item.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Min Level</p>
                              <p className="text-lg font-bold text-slate-900">{item.minStockLevel}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Max Level</p>
                              <p className="text-lg font-bold text-slate-900">{item.maxStockLevel}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Unit Cost</p>
                              <p className="text-lg font-bold text-slate-900">${item.unitCost.toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-slate-600">
                            <p>Total Value: ${(item.currentStock * item.unitCost).toFixed(2)}</p>
                            {item.supplier && <p>Supplier: {item.supplier}</p>}
                          </div>
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsCountModalOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <RotateCcw size={14} />
                            Count
                          </Button>

                          {item.currentStock <= item.minStockLevel && (
                            <Button
                              onClick={() => {
                                setSelectedItem(item);
                                setReorderQty(item.reorderQuantity.toString());
                                setIsReorderModalOpen(true);
                              }}
                              size="sm"
                              className="gap-2 bg-red-600 hover:bg-red-700"
                            >
                              <Plus size={14} />
                              Reorder
                            </Button>
                          )}

                          <Button
                            onClick={() => handleOpenEdit(item)}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Edit size={14} />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Stock Counts Tab */}
      {activeTab === 'counts' && (
        <div className="space-y-3">
          {stockCounts.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <RotateCcw className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No stock counts recorded</h3>
              <p className="text-slate-600">Physical counts will appear here</p>
            </div>
          ) : (
            stockCounts.map((count) => (
              <div key={count.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900">{count.itemName}</h3>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-slate-600">System Count</p>
                        <p className="text-lg font-bold text-slate-900">{count.systemCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Physical Count</p>
                        <p className="text-lg font-bold text-slate-900">{count.physicalCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Discrepancy</p>
                        <p className={cn('text-lg font-bold', count.discrepancy < 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {count.discrepancy > 0 ? '+' : ''}{count.discrepancy}
                        </p>
                      </div>
                    </div>
                    {count.notes && <p className="text-sm text-slate-600 mt-2">{count.notes}</p>}
                  </div>
                  <div className="text-xs text-slate-600 text-right">
                    <p>{count.countedAt.toDate().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reorders Tab */}
      {activeTab === 'reorders' && (
        <div className="space-y-3">
          {reorders.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No reorder requests</h3>
              <p className="text-slate-600">Reorder requests will appear here</p>
            </div>
          ) : (
            reorders.map((reorder) => (
              <div key={reorder.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{reorder.itemName}</h3>
                      <Badge className={cn(
                        'gap-1',
                        reorder.status === 'pending' ? 'bg-amber-600' :
                        reorder.status === 'ordered' ? 'bg-blue-600' :
                        'bg-green-600'
                      )}>
                        {reorder.status.charAt(0).toUpperCase() + reorder.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-slate-600">Quantity</p>
                        <p className="text-lg font-bold text-slate-900">{reorder.quantity}</p>
                      </div>
                      {reorder.supplier && (
                        <div>
                          <p className="text-xs text-slate-600">Supplier</p>
                          <p className="text-sm font-medium text-slate-900">{reorder.supplier}</p>
                        </div>
                      )}
                      {reorder.cost && (
                        <div>
                          <p className="text-xs text-slate-600">Cost</p>
                          <p className="text-lg font-bold text-slate-900">${reorder.cost.toFixed(2)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-600">Created</p>
                        <p className="text-sm font-medium text-slate-900">{reorder.createdAt.toDate().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Item Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editCategory} onValueChange={(v) => setEditCategory(v as typeof inventoryCategories[0])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="e.g., bottles, rolls" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Stock</Label>
                <Input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Level</Label>
                <Input type="number" value={editMinLevel} onChange={(e) => setEditMinLevel(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Max Level</Label>
                <Input type="number" value={editMaxLevel} onChange={(e) => setEditMaxLevel(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reorder Quantity</Label>
              <Input type="number" value={editReorderQty} onChange={(e) => setEditReorderQty(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700">
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Stock Modal */}
      <Dialog open={isCountModalOpen} onOpenChange={setIsCountModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Count Stock - {selectedItem?.name}</DialogTitle>
            <DialogDescription>Record physical count for this item</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">System Count</p>
              <p className="text-2xl font-bold text-slate-900">{selectedItem?.currentStock} {selectedItem?.unit}</p>
            </div>

            <div className="space-y-2">
              <Label>Physical Count</Label>
              <Input
                type="number"
                placeholder="0"
                value={countPhysical}
                onChange={(e) => setCountPhysical(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any discrepancies or notes..."
                value={countNotes}
                onChange={(e) => setCountNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCountModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCountStock} disabled={isCountingSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isCountingSubmitting ? 'Recording...' : 'Record Count'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reorder Modal */}
      <Dialog open={isReorderModalOpen} onOpenChange={setIsReorderModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Reorder - {selectedItem?.name}</DialogTitle>
            <DialogDescription>Create a purchase order for this item</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={reorderQty}
                onChange={(e) => setReorderQty(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                placeholder={selectedItem?.supplier || 'Enter supplier name'}
                value={reorderSupplier}
                onChange={(e) => setReorderSupplier(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReorderModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReorder} disabled={isReorderSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isReorderSubmitting ? 'Creating...' : 'Create Reorder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
