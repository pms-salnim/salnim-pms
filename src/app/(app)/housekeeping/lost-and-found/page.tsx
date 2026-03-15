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
  Plus,
  Edit,
  Search as SearchIcon,
  Package,
  Clock,
  MapPin,
  User,
  Phone,
  Trash2,
  CheckCircle,
  AlertTriangle,
  User2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Property } from '@/types/property';

interface LostFoundItem {
  id: string;
  propertyId: string;
  itemName: string;
  description: string;
  category: 'Valuables' | 'Clothing' | 'Electronics' | 'Accessories' | 'Bedding' | 'Documents' | 'Other';
  foundDate: Timestamp;
  foundLocation: string;
  status: 'unclaimed' | 'claimed' | 'returned' | 'discarded';
  roomNumber?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  storageLocation?: string;
  claimedDate?: Timestamp;
  claimedBy?: string;
  returnMethod?: 'pickup' | 'mailed' | 'courier';
  notes?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const itemCategories = ['Valuables', 'Clothing', 'Electronics', 'Accessories', 'Bedding', 'Documents', 'Other'] as const;

export default function LostAndFoundPage() {
  const { user, isLoadingAuth } = useAuth();

  // State
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('unclaimed');

  // Modals
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  // Add/Edit form
  const [formItemName, setFormItemName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<typeof itemCategories[0]>('Accessories');
  const [formFoundLocation, setFormFoundLocation] = useState('');
  const [formStorageLocation, setFormStorageLocation] = useState('');
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Claim form
  const [claimGuestName, setClaimGuestName] = useState('');
  const [claimGuestPhone, setClaimGuestPhone] = useState('');
  const [claimGuestEmail, setClaimGuestEmail] = useState('');
  const [claimReturnMethod, setClaimReturnMethod] = useState<'pickup' | 'mailed' | 'courier'>('pickup');
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);

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

  // Fetch lost & found items
  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const itemsQuery = query(
      collection(db, 'lostAndFound'),
      where('propertyId', '==', propertyId),
      orderBy('foundDate', 'desc')
    );

    const unsubItems = onSnapshot(itemsQuery, (snapshot) => {
      const fetchedItems = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as LostFoundItem));
      setItems(fetchedItems);
      setIsLoading(false);
    });

    return () => unsubItems();
  }, [propertyId]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !item.itemName.toLowerCase().includes(query) &&
          !item.description.toLowerCase().includes(query) &&
          !(item.roomNumber && item.roomNumber.includes(query)) &&
          !(item.guestName && item.guestName.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      return true;
    });
  }, [items, searchQuery, categoryFilter, statusFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const unclaimedItems = items.filter((i) => i.status === 'unclaimed').length;
    const claimedItems = items.filter((i) => i.status === 'claimed').length;
    const returnedItems = items.filter((i) => i.status === 'returned').length;
    const discardedItems = items.filter((i) => i.status === 'discarded').length;

    // Items older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oldItems = items.filter(
      (i) => i.status === 'unclaimed' && i.foundDate.toDate() < thirtyDaysAgo
    ).length;

    return {
      unclaimedItems,
      claimedItems,
      returnedItems,
      discardedItems,
      oldItems,
      totalItems: items.length,
    };
  }, [items]);

  const resetAddForm = () => {
    setFormItemName('');
    setFormDescription('');
    setFormCategory('Accessories');
    setFormFoundLocation('');
    setFormStorageLocation('');
    setFormRoomNumber('');
    setFormNotes('');
  };

  const handleAddItem = async () => {
    if (!formItemName.trim() || !formFoundLocation.trim()) {
      toast({ title: 'Error', description: 'Please fill required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'lostAndFound'), {
        propertyId,
        itemName: formItemName,
        description: formDescription,
        category: formCategory,
        foundDate: Timestamp.now(),
        foundLocation: formFoundLocation,
        status: 'unclaimed',
        roomNumber: formRoomNumber || null,
        storageLocation: formStorageLocation,
        notes: formNotes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Item added to lost & found' });
      setIsAddModalOpen(false);
      resetAddForm();
    } catch (error) {
      console.error('Error adding item:', error);
      toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'lostAndFound', selectedItem.id), {
        itemName: formItemName,
        description: formDescription,
        category: formCategory,
        foundLocation: formFoundLocation,
        roomNumber: formRoomNumber || null,
        storageLocation: formStorageLocation,
        notes: formNotes,
        updatedAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Item updated' });
      setIsEditModalOpen(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimItem = async () => {
    if (!selectedItem || !claimGuestName.trim()) {
      toast({ title: 'Error', description: 'Please fill guest name', variant: 'destructive' });
      return;
    }

    setIsClaimSubmitting(true);
    try {
      await updateDoc(doc(db, 'lostAndFound', selectedItem.id), {
        status: 'claimed',
        claimedDate: Timestamp.now(),
        claimedBy: user?.id,
        guestName: claimGuestName,
        guestPhone: claimGuestPhone,
        guestEmail: claimGuestEmail,
        returnMethod: claimReturnMethod,
        updatedAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Item marked as claimed' });
      setIsClaimModalOpen(false);
      setSelectedItem(null);
      setClaimGuestName('');
      setClaimGuestPhone('');
      setClaimGuestEmail('');
      setClaimReturnMethod('pickup');
    } catch (error) {
      console.error('Error claiming item:', error);
      toast({ title: 'Error', description: 'Failed to claim item', variant: 'destructive' });
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  const handleReturnItem = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'lostAndFound', itemId), {
        status: 'returned',
        updatedAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Item marked as returned' });
    } catch (error) {
      console.error('Error marking returned:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'lostAndFound', itemId), {
        status: 'discarded',
        updatedAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Item marked as discarded' });
    } catch (error) {
      console.error('Error discarding item:', error);
      toast({ title: 'Error', description: 'Failed to discard item', variant: 'destructive' });
    }
  };

  const handleOpenEdit = (item: LostFoundItem) => {
    setSelectedItem(item);
    setFormItemName(item.itemName);
    setFormDescription(item.description);
    setFormCategory(item.category);
    setFormFoundLocation(item.foundLocation);
    setFormStorageLocation(item.storageLocation || '');
    setFormRoomNumber(item.roomNumber || '');
    setFormNotes(item.notes || '');
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unclaimed':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'claimed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'returned':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'discarded':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
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
        <AlertDescription>You do not have permission to access lost & found management.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Lost & Found</h1>
          <p className="text-slate-600 mt-2">Track and manage guest belongings</p>
        </div>
        <Button
          onClick={() => {
            resetAddForm();
            setIsAddModalOpen(true);
          }}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Item
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unclaimed Items</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.unclaimedItems}</h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Claimed Items</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.claimedItems}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <CheckCircle size={18} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Returned This Month</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.returnedItems}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <User2 size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Old Items (&gt;30 days)</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.oldItems}</h3>
            </div>
            <div className="p-2 rounded-lg bg-red-50">
              <Clock size={18} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-slate-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Items</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.totalItems}</h3>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <Package size={18} className="text-slate-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-4 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, room, or guest..."
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
              {itemCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unclaimed">Unclaimed</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="discarded">Discarded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No items found</h3>
            <p className="text-slate-600">Adjust your filters or add new items</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-bold text-slate-900">{item.itemName}</h3>
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      <Badge className={cn('text-xs', getStatusColor(item.status))}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Description */}
                    {item.description && (
                      <p className="text-sm text-slate-700 mb-3">{item.description}</p>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-600 flex items-center gap-1">
                          <MapPin size={12} />
                          Found Location
                        </p>
                        <p className="text-sm font-medium text-slate-900">{item.foundLocation}</p>
                      </div>

                      {item.storageLocation && (
                        <div>
                          <p className="text-xs text-slate-600">Storage Location</p>
                          <p className="text-sm font-medium text-slate-900">{item.storageLocation}</p>
                        </div>
                      )}

                      {item.roomNumber && (
                        <div>
                          <p className="text-xs text-slate-600">Room Number</p>
                          <p className="text-sm font-medium text-slate-900">{item.roomNumber}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-slate-600 flex items-center gap-1">
                          <Clock size={12} />
                          Found Date
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDistanceToNow(item.foundDate.toDate(), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Guest Info (if claimed) */}
                    {item.status === 'claimed' && item.guestName && (
                      <div className="bg-blue-50 rounded p-3 mb-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-slate-600 flex items-center gap-1">
                              <User size={12} />
                              Guest Name
                            </p>
                            <p className="text-sm font-medium text-slate-900">{item.guestName}</p>
                          </div>
                          {item.guestPhone && (
                            <div>
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <Phone size={12} />
                                Phone
                              </p>
                              <p className="text-sm font-medium text-slate-900">{item.guestPhone}</p>
                            </div>
                          )}
                          {item.guestEmail && (
                            <div>
                              <p className="text-xs text-slate-600">Email</p>
                              <p className="text-sm font-medium text-slate-900 truncate">{item.guestEmail}</p>
                            </div>
                          )}
                          {item.returnMethod && (
                            <div>
                              <p className="text-xs text-slate-600">Return Method</p>
                              <p className="text-sm font-medium text-slate-900 capitalize">
                                {item.returnMethod === 'mailed' ? 'Mailed' : item.returnMethod === 'courier' ? 'Courier' : 'Pickup'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {item.notes && (
                      <div className="text-sm text-slate-700 bg-slate-50 rounded p-3">
                        <p className="font-medium mb-1">Notes:</p>
                        <p>{item.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {item.status === 'unclaimed' && (
                      <>
                        <Button
                          onClick={() => {
                            setSelectedItem(item);
                            setClaimGuestName('');
                            setClaimGuestPhone('');
                            setClaimGuestEmail('');
                            setClaimReturnMethod('pickup');
                            setIsClaimModalOpen(true);
                          }}
                          size="sm"
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle size={14} />
                          Claim
                        </Button>
                        <Button
                          onClick={() => handleOpenEdit(item)}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Edit size={14} />
                          Edit
                        </Button>
                      </>
                    )}

                    {item.status === 'claimed' && (
                      <Button
                        onClick={() => handleReturnItem(item.id)}
                        size="sm"
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        <User2 size={14} />
                        Mark Returned
                      </Button>
                    )}

                    {item.status !== 'discarded' && item.status !== 'returned' && (
                      <Button
                        onClick={() => handleDeleteItem(item.id)}
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                      >
                        <Trash2 size={14} />
                        Discard
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Item Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lost & Found Item</DialogTitle>
            <DialogDescription>Record a new item in the lost & found</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={formItemName}
                onChange={(e) => setFormItemName(e.target.value)}
                placeholder="e.g., Black Wallet"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Details about the item..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as typeof itemCategories[0])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input
                  value={formRoomNumber}
                  onChange={(e) => setFormRoomNumber(e.target.value)}
                  placeholder="e.g., 302"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Found Location *</Label>
              <Input
                value={formFoundLocation}
                onChange={(e) => setFormFoundLocation(e.target.value)}
                placeholder="e.g., Front Desk, Room 302, Lobby"
              />
            </div>

            <div className="space-y-2">
              <Label>Storage Location</Label>
              <Input
                value={formStorageLocation}
                onChange={(e) => setFormStorageLocation(e.target.value)}
                placeholder="e.g., Safe Box 5, Storage Room Shelf A"
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                resetAddForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Lost & Found Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input value={formItemName} onChange={(e) => setFormItemName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as typeof itemCategories[0])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input value={formRoomNumber} onChange={(e) => setFormRoomNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Found Location</Label>
              <Input value={formFoundLocation} onChange={(e) => setFormFoundLocation(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Storage Location</Label>
              <Input value={formStorageLocation} onChange={(e) => setFormStorageLocation(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateItem} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claim Item Modal */}
      <Dialog open={isClaimModalOpen} onOpenChange={setIsClaimModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Claimed - {selectedItem?.itemName}</DialogTitle>
            <DialogDescription>Record guest information and return method</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Guest Name *</Label>
              <Input
                value={claimGuestName}
                onChange={(e) => setClaimGuestName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={claimGuestPhone}
                onChange={(e) => setClaimGuestPhone(e.target.value)}
                placeholder="Contact number"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={claimGuestEmail}
                onChange={(e) => setClaimGuestEmail(e.target.value)}
                placeholder="Email address"
              />
            </div>

            <div className="space-y-2">
              <Label>Return Method</Label>
              <Select value={claimReturnMethod} onValueChange={(v) => setClaimReturnMethod(v as 'pickup' | 'mailed' | 'courier')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Guest Pickup</SelectItem>
                  <SelectItem value="mailed">Mailed</SelectItem>
                  <SelectItem value="courier">Courier Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClaimItem} disabled={isClaimSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {isClaimSubmitting ? 'Marking...' : 'Mark as Claimed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
