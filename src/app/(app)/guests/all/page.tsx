"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/types/firestoreUser';
import type { Guest } from '@/types/guest';
import { getLoyaltyTier } from '@/types/loyalty';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Reservation } from '@/types/reservation';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Crown, UserCheck, Eye, Edit2, Trash2, MoreVertical, Plus, Gift, Phone, MessageSquare, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from 'date-fns';

const GuestForm = dynamic(() => import('@/components/guests/guest-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const GuestProfile = dynamic(() => import('@/components/guests/guest-profile'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

type GuestTypeFilter = 'all' | 'repeat' | 'onetime' | 'vip';

export default function AllGuestsPage() {
  const { user, isLoadingAuth, property } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(true);
  const [currentUserPropertyId, setCurrentUserPropertyId] = useState<string | null>(null);

  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [isEditGuestModalOpen, setIsEditGuestModalOpen] = useState(false);
  const [isViewProfileModalOpen, setIsViewProfileModalOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [guestTypeFilter, setGuestTypeFilter] = useState<GuestTypeFilter>('all');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set<string>());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const canManage = user?.permissions?.guests;

  // Load property ID
  useEffect(() => {
    if (user?.id) {
      const staffDocRef = doc(db, "staff", user.id);
      const unsub = onSnapshot(staffDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const staffData = docSnap.data() as FirestoreUser;
          setCurrentUserPropertyId(staffData.propertyId);
        }
      });
      return () => unsub();
    }
  }, [user?.id]);

  // Load guests and reservations
  useEffect(() => {
    if (!currentUserPropertyId) {
      setGuests([]);
      setReservations([]);
      setIsLoadingGuests(false);
      return;
    }

    setIsLoadingGuests(true);
    let listeners = 2;
    const doneLoading = () => {
      listeners--;
      if (listeners === 0) {
        setIsLoadingGuests(false);
        setLastSyncTime(new Date());
      }
    };

    const guestQuery = query(collection(db, 'guests'), where('propertyId', '==', currentUserPropertyId));
    const unsubGuests = onSnapshot(guestQuery, (snapshot) => {
      const fetchedGuests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest));
      setGuests(fetchedGuests);
      setLastSyncTime(new Date());
      doneLoading();
    }, (error) => {
      console.error('Error listening to guests:', error);
      doneLoading();
    });

    const reservationsQuery = query(collection(db, 'reservations'), where('propertyId', '==', currentUserPropertyId));
    const unsubReservations = onSnapshot(reservationsQuery, (snapshot) => {
      const fetchedReservations = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startDate: (d.data().startDate as Timestamp)?.toDate(),
        endDate: (d.data().endDate as Timestamp)?.toDate(),
      } as Reservation));
      setReservations(fetchedReservations);
      setLastSyncTime(new Date());
      doneLoading();
    }, (error) => {
      console.error('Error listening to reservations:', error);
      doneLoading();
    });

    return () => {
      unsubGuests();
      unsubReservations();
    };
  }, [currentUserPropertyId]);

  // Check if user returned from booking with new reservation and sync guest data
  useEffect(() => {
    const guestEmailForSync = typeof window !== 'undefined' ? sessionStorage.getItem('guestEmailForSync') : null;
    if (guestEmailForSync && currentUserPropertyId) {
      // Clear the flag
      sessionStorage.removeItem('guestEmailForSync');
      
      // Find and update the guest with this email to show latest reservation data
      const matchingGuest = guests.find(g => g.email === guestEmailForSync);
      if (matchingGuest) {
        // The real-time listener will automatically update the guest data
        // Just refresh the view by setting selected guest again
        setSelectedGuest(matchingGuest);
        // Show a toast to indicate data was synced
        toast({ title: 'Synced', description: 'Guest data updated with new reservation' });
      }
    }
  }, [guests, currentUserPropertyId]);

  // Get guest details
  const getGuestDetails = (guest: Guest) => {
    const guestReservations = reservations.filter(r => r.guestId === guest.id && r.status !== 'Canceled' && r.status !== 'No-Show');
    const visits = guestReservations.length;
    const lastStayDate = guestReservations.length > 0
      ? new Date(Math.max(...guestReservations.map(r => {
          const endDate = r.endDate instanceof Date ? r.endDate : (r.endDate as Timestamp).toDate();
          return endDate.getTime();
        })))
      : null;
    const totalSpent = guestReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    
    return { visits, lastStayDate, totalSpent };
  };

  // Calculate KPI metrics
  // NOTE: Loyalty points are only awarded when a reservation is Completed AND Checked-Out
  // The cloud functions (updateGuestStatsOnReservationComplete, onReservationUpdate) are responsible for calculating and assigning points
  const { totalGuestCount, repeatGuestCount, vipGuestCount, avgVisitsCount } = useMemo(() => {
    if (guests.length === 0) return { totalGuestCount: 0, repeatGuestCount: 0, vipGuestCount: 0, avgVisitsCount: '0' };

    let repeatCount = 0, vipCount = 0;
    let totalVisits = 0;

    // Get VIP threshold from property settings (based on actual loyalty points earned, not visits)
    const vipThreshold = property?.loyaltyProgramSettings?.tiers?.find(t => t.name?.toLowerCase() === 'vip')?.minPoints || 100;

    guests.forEach(guest => {
      const { visits } = getGuestDetails(guest);
      totalVisits += visits;
      
      if (visits >= 2) repeatCount++;
      
      // Count VIPs based on actual loyalty points earned (calculated by cloud functions)
      if (guest.loyaltyStatus === 'enrolled' && (guest.totalPointsEarned || 0) >= vipThreshold) vipCount++;
    });

    return {
      totalGuestCount: guests.length,
      repeatGuestCount: repeatCount,
      vipGuestCount: vipCount,
      avgVisitsCount: guests.length > 0 ? (totalVisits / guests.length).toFixed(1) : '0'
    };
  }, [guests, reservations, property?.loyaltyProgramSettings]);

  // Filter guests
  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const { visits } = getGuestDetails(guest);
      const fullName = `${guest.firstName || ''} ${guest.lastName || ''}`.toLowerCase();
      
      const matchesSearch = !searchQuery || 
        fullName.includes(searchQuery.toLowerCase()) ||
        guest.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.phone?.includes(searchQuery);

      if (guestTypeFilter === 'all') return matchesSearch;
      if (guestTypeFilter === 'repeat') return matchesSearch && visits >= 2;
      if (guestTypeFilter === 'onetime') return matchesSearch && visits === 1;
      
      if (guestTypeFilter === 'vip') {
        const isEnrolled = guest.loyaltyStatus === 'enrolled';
        if (!matchesSearch || !isEnrolled) return false;
        
        // If a tier is selected, filter by that tier
        if (selectedTierFilter) {
          const tiers = property?.loyaltyProgramSettings?.tiers || [];
          const guestTier = getLoyaltyTier(guest.totalPointsEarned || 0, tiers);
          return guestTier.name === selectedTierFilter;
        }
        return true;
      }
      
      return matchesSearch;
    });
  }, [guests, searchQuery, guestTypeFilter, selectedTierFilter, property?.loyaltyProgramSettings]);

  // Handlers
  const handleAddGuest = () => {
    setSelectedGuest(null);
    setIsAddGuestModalOpen(true);
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      // Trigger a manual refresh - Firestore real-time listeners will handle the update
      if (currentUserPropertyId) {
        const guestQuery = query(collection(db, 'guests'), where('propertyId', '==', currentUserPropertyId));
        const reservationsQuery = query(collection(db, 'reservations'), where('propertyId', '==', currentUserPropertyId));
        
        await Promise.all([
          new Promise(resolve => {
            const unsub = onSnapshot(guestQuery, () => {
              unsub();
              resolve(null);
            });
          }),
          new Promise(resolve => {
            const unsub = onSnapshot(reservationsQuery, () => {
              unsub();
              resolve(null);
            });
          })
        ]);
        
        toast({ title: 'Data Refreshed', description: 'Guest and reservation data synced' });
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({ title: 'Error', description: 'Failed to refresh data', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEditGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsEditGuestModalOpen(true);
  };

  const handleViewProfile = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsViewProfileModalOpen(true);
  };

  const handleDeleteGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsBulkDeleteDialogOpen(true);
  };

  const handleCreateReservation = (guest: Guest) => {
    // Store guest data for reservation creation form
    const guestData = {
      id: guest.id,
      fullName: guest.fullName || `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || '',
      email: guest.email || '',
      phone: guest.phone || '',
      country: guest.country || 'Morocco',
      passportOrId: guest.passportOrId || '',
    };
    sessionStorage.setItem('prefilledGuestData', JSON.stringify(guestData));
    // Navigate to dashboard where reservation form is available
    window.location.href = '/dashboard';
  };

  const handleContactGuest = (guest: Guest, type: 'portal' | 'email' | 'whatsapp') => {
    if (type === 'email' && guest.email) {
      window.location.href = `mailto:${guest.email}`;
    } else if (type === 'whatsapp' && guest.phone) {
      const phone = guest.phone.replace(/\D/g, '');
      window.location.href = `https://wa.me/${phone}`;
    } else if (type === 'portal') {
      toast({ title: 'Guest Portal', description: 'Guest portal feature coming soon' });
    }
  };

  const handleEnrollLoyalty = async (guest: Guest) => {
    if (!currentUserPropertyId) return;
    try {
      await updateDoc(doc(db, 'guests', guest.id), {
        loyaltyStatus: 'enrolled',
        updatedAt: Timestamp.now()
      });
      toast({ title: 'Success', description: `${guest.firstName} enrolled in loyalty program` });
    } catch (error) {
      console.error('Error enrolling guest:', error);
      toast({ title: 'Error', description: 'Failed to enroll guest', variant: 'destructive' });
    }
  };

  const handleBulkEnrollLoyalty = async () => {
    if (selectedRowIds.size === 0) return;
    try {
      const guestsToUpdate = guests.filter(g => selectedRowIds.has(g.id));
      const updatePromises = guestsToUpdate.map(guest =>
        updateDoc(doc(db, 'guests', guest.id), {
          loyaltyStatus: 'enrolled',
          updatedAt: Timestamp.now()
        })
      );
      await Promise.all(updatePromises);
      setSelectedRowIds(new Set());
      toast({ title: 'Success', description: `${guestsToUpdate.length} guest(s) enrolled in loyalty program` });
    } catch (error) {
      console.error('Error bulk enrolling guests:', error);
      toast({ title: 'Error', description: 'Failed to enroll guests', variant: 'destructive' });
    }
  };

  const handleBulkContactEmail = () => {
    const guestsToContact = guests.filter(g => selectedRowIds.has(g.id) && g.email);
    if (guestsToContact.length === 0) {
      toast({ title: 'Info', description: 'No guests with email addresses selected' });
      return;
    }
    const emails = guestsToContact.map(g => g.email).join(',');
    window.location.href = `mailto:${emails}`;
  };

  const handleBulkContactWhatsApp = () => {
    const guestsToContact = guests.filter(g => selectedRowIds.has(g.id) && g.phone);
    if (guestsToContact.length === 0) {
      toast({ title: 'Info', description: 'No guests with phone numbers selected' });
      return;
    }
    if (guestsToContact.length === 1) {
      const phone = guestsToContact[0].phone.replace(/\D/g, '');
      window.location.href = `https://wa.me/${phone}`;
    } else {
      toast({ title: 'Info', description: 'WhatsApp bulk contact works with one guest at a time. Please select one guest.' });
    }
  };

  const handleBulkDelete = () => {
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedRowIds.size === 0) return;
    try {
      const deletePromises = Array.from(selectedRowIds).map(guestId =>
        deleteDoc(doc(db, 'guests', guestId))
      );
      await Promise.all(deletePromises);
      setSelectedRowIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      toast({ title: 'Success', description: `${selectedRowIds.size} guest(s) deleted successfully` });
    } catch (error) {
      console.error('Error bulk deleting guests:', error);
      toast({ title: 'Error', description: 'Failed to delete guests', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!selectedGuest) return;
    try {
      await deleteDoc(doc(db, 'guests', selectedGuest.id));
      setSelectedGuest(null);
      setIsBulkDeleteDialogOpen(false);
      toast({ title: 'Success', description: 'Guest deleted successfully' });
    } catch (error) {
      console.error('Error deleting guest:', error);
      toast({ title: 'Error', description: 'Failed to delete guest', variant: 'destructive' });
    }
  };

  const handleSaveGuest = async (guestData: Partial<Guest>) => {
    if (!currentUserPropertyId) return;
    try {
      if (selectedGuest) {
        await updateDoc(doc(db, 'guests', selectedGuest.id), guestData);
        setIsEditGuestModalOpen(false);
      } else {
        await addDoc(collection(db, 'guests'), {
          ...guestData,
          propertyId: currentUserPropertyId,
          createdAt: new Date(),
        });
        setIsAddGuestModalOpen(false);
      }
      setSelectedGuest(null);
      toast({ title: 'Success', description: 'Guest saved successfully' });
    } catch (error) {
      console.error('Error saving guest:', error);
      toast({ title: 'Error', description: 'Failed to save guest', variant: 'destructive' });
    }
  };

  const handleReservationCreated = async (guestEmail: string, reservations: Reservation[]) => {
    // Refresh guest data when a reservation is created with matching email
    if (guestEmail && currentUserPropertyId) {
      try {
        // Find the guest with matching email
        const guestQuery = query(
          collection(db, 'guests'),
          where('email', '==', guestEmail),
          where('propertyId', '==', currentUserPropertyId)
        );
        
        const snapshot = await new Promise<any>((resolve) => {
          const unsub = onSnapshot(guestQuery, (snap) => {
            unsub();
            resolve(snap);
          });
        });
        
        if (snapshot.docs.length > 0) {
          const updatedGuest = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Guest;
          // Update selected guest with fresh data
          setSelectedGuest(updatedGuest);
          
          // Filter new reservations for this guest email
        const guestReservations = reservations.filter(r => r.guestEmail === guestEmail);
          // Log the sync for debugging
          console.log(`Synced guest ${guestEmail} with ${guestReservations.length} reservations`);
        }
        
        // Close modal after sync
        setIsViewProfileModalOpen(false);
        toast({ title: 'Success', description: 'Reservation created successfully! All data synced.' });
      } catch (error) {
        console.error('Error syncing guest data after reservation:', error);
        setIsViewProfileModalOpen(false);
        toast({ title: 'Info', description: 'Reservation created. Please refresh to see updates.' });
      }
    } else {
      setIsViewProfileModalOpen(false);
    }
  };

  if (isLoadingAuth || (isLoadingGuests && !currentUserPropertyId)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }
  
  if (!user?.permissions?.guests) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view the guest list. Please contact an administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Guests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and view all guests
            {lastSyncTime && (
              <span className="ml-2 text-xs text-slate-400">
                Last synced: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={isRefreshing || isLoadingGuests}
            className="text-slate-600 hover:text-slate-700"
          >
            {isRefreshing || isLoadingGuests ? (
              <>
                <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Icons.RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
          <Dialog open={isAddGuestModalOpen} onOpenChange={setIsAddGuestModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddGuest} disabled={!canManage}>
                <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add Guest
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Guest</DialogTitle>
                <DialogDescription>
                  Create a new guest profile in the system
                </DialogDescription>
              </DialogHeader>
              <GuestForm
                onClose={() => setIsAddGuestModalOpen(false)}
                onSave={handleSaveGuest}
                initialData={null}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Guests</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{totalGuestCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <Users size={18} className="text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[10px] font-medium text-blue-600">All registered guests</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Repeat Guests</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{repeatGuestCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[10px] font-medium text-emerald-600">
              {totalGuestCount > 0 ? ((repeatGuestCount / totalGuestCount) * 100).toFixed(0) : 0}% of total
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loyalty Program</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{vipGuestCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <Crown size={18} className="text-amber-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[10px] font-medium text-amber-600">Loyal members & frequent</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-cyan-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Visits</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{avgVisitsCount}</h3>
            </div>
            <div className="p-2 rounded-lg bg-cyan-50">
              <UserCheck size={18} className="text-cyan-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[10px] font-medium text-cyan-600">Per guest average</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 flex gap-4 items-center flex-wrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[250px]">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Main Filters */}
          <div className="flex gap-2 items-center flex-shrink-0">
            {(['all', 'repeat', 'onetime', 'vip'] as GuestTypeFilter[]).map((filter) => {
              const colorClasses = {
                all: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
                repeat: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200',
                onetime: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
                vip: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200',
              };
              const activeClasses = {
                all: 'bg-slate-600 text-white border-slate-600',
                repeat: 'bg-emerald-600 text-white border-emerald-600',
                onetime: 'bg-blue-600 text-white border-blue-600',
                vip: 'bg-amber-600 text-white border-amber-600',
              };
              
              const isActive = guestTypeFilter === filter;
              
              return (
                <Button
                  key={filter}
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestTypeFilter(filter)}
                  className={`${isActive ? activeClasses[filter] : colorClasses[filter]}`}
                >
                  {filter === 'all' && 'All Guests'}
                  {filter === 'repeat' && 'Repeat Guests'}
                  {filter === 'onetime' && 'One-time Guests'}
                  {filter === 'vip' && 'Loyalty Program'}
                </Button>
              );
            })}
          </div>

          {/* Tier Filter - Only show when Loyalty Program filter is active */}
          {guestTypeFilter === 'vip' && property?.loyaltyProgramSettings?.tiers && property.loyaltyProgramSettings.tiers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 flex-shrink-0">
                  <Icons.Filter className="h-4 w-4" />
                  Filter by Tier
                  {selectedTierFilter && <span className="text-xs font-semibold text-amber-600">({selectedTierFilter})</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setSelectedTierFilter(null)}>
                  <span className={`${selectedTierFilter === null ? 'font-bold' : ''}`}>All Tiers</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {property.loyaltyProgramSettings.tiers.map((tier) => (
                  <DropdownMenuItem key={tier.name} onClick={() => setSelectedTierFilter(tier.name)}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${tier.colorClass || 'bg-blue-500'}`}></div>
                      <span className={`${selectedTierFilter === tier.name ? 'font-bold' : ''}`}>{tier.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Guest Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Bulk Actions Bar */}
        {selectedRowIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={selectedRowIds.size === filteredGuests.length && filteredGuests.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRowIds(new Set(filteredGuests.map(g => g.id)));
                  } else {
                    setSelectedRowIds(new Set());
                  }
                }}
              />
              <span className="text-sm font-medium text-slate-700">
                {selectedRowIds.size} guest{selectedRowIds.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-100">
                    <Phone className="mr-2 h-4 w-4" />
                    Contact
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleBulkContactEmail}>
                    <Icons.Mail className="mr-2 h-4 w-4" />
                    Email All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkContactWhatsApp}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkEnrollLoyalty}
                disabled={!canManage}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
              >
                <Gift className="mr-2 h-4 w-4" />
                Enroll in Loyalty
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkDelete}
                disabled={!canManage}
                className="text-red-600 hover:text-red-700 hover:bg-red-100"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedRowIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        {filteredGuests.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No guests found
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-medium border-b border-slate-200 bg-slate-50/30">
                  <th className="w-12 py-3 px-4 border-r border-slate-50">
                    <Checkbox />
                  </th>
                  <th className="py-3 px-4 border-r border-slate-50">Name</th>
                  <th className="py-3 px-4 border-r border-slate-50">Email</th>
                  <th className="py-3 px-4 border-r border-slate-50">Phone</th>
                  <th className="py-3 px-4 border-r border-slate-50">Visits</th>
                  <th className="py-3 px-4 border-r border-slate-50">Last Stay</th>
                  <th className="py-3 px-4 border-r border-slate-50">Total Spent</th>
                  <th className="py-3 px-4 border-r border-slate-50">Loyalty</th>
                  <th className="py-3 px-4 border-r border-slate-50">Country</th>
                  <th className="py-3 px-4 text-right">More</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGuests.map((guest) => {
                  const details = getGuestDetails(guest);
                  const fullName = guest.fullName || `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || 'N/A';
                  
                  return (
                    <tr key={guest.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 border-r border-slate-200">
                        <Checkbox
                          checked={selectedRowIds.has(guest.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedRowIds);
                            if (checked) newSet.add(guest.id);
                            else newSet.delete(guest.id);
                            setSelectedRowIds(newSet);
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="font-bold text-slate-800">{fullName}</div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <button
                          onClick={() => {
                            if (guest.email) {
                              window.location.href = 'mailto:' + guest.email;
                            }
                          }}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {guest.email || '-'}
                        </button>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <button
                          onClick={() => {
                            if (guest.phone) {
                              window.location.href = 'tel:' + guest.phone;
                            }
                          }}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {guest.phone || '-'}
                        </button>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {details.visits}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm text-slate-800">
                          {details.lastStayDate ? format(details.lastStayDate, 'dd/MM/yy') : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm font-semibold text-emerald-600">
                          ${details.totalSpent.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        {(() => {
                          // Display actual loyalty tier based on points awarded by cloud functions
                          // Points are only awarded when reservation is Completed AND Checked-Out
                          if (guest.loyaltyStatus !== 'enrolled') {
                            return (
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                  Not Enrolled
                                </Badge>
                              </div>
                            );
                          }

                          const tiers = property?.loyaltyProgramSettings?.tiers || [];
                          const actualTier = getLoyaltyTier(guest.totalPointsEarned || 0, tiers);
                          
                          // Determine badge color
                          const tierNameLower = actualTier.name?.toLowerCase() || '';
                          let badgeColor = 'bg-blue-500 text-white';
                          if (tierNameLower === 'vip' || tierNameLower === 'platinum') {
                            badgeColor = 'bg-amber-500 text-white';
                          } else if (tierNameLower === 'gold' || tierNameLower === 'premium') {
                            badgeColor = 'bg-yellow-500 text-white';
                          } else if (tierNameLower === 'silver') {
                            badgeColor = 'bg-slate-400 text-white';
                          }

                          return (
                            <div className="flex flex-col gap-1">
                              <Badge variant="default" className={badgeColor}>
                                {actualTier.name}
                              </Badge>
                              <span className="text-xs text-slate-500">{(guest.loyaltyPoints || 0).toLocaleString()} pts</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-50">
                        <div className="text-sm text-slate-800">{guest.nationality || guest.country || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-slate-400 hover:text-slate-600">
                              <MoreVertical size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => handleViewProfile(guest)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEditGuest(guest)} disabled={!canManage}>
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCreateReservation(guest)} disabled={!canManage}>
                              <Plus className="mr-2 h-4 w-4" />
                              Create Reservation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Phone className="mr-2 h-4 w-4" />
                                <span>Contact</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => handleContactGuest(guest, 'portal')}>
                                  <Globe className="mr-2 h-4 w-4" />
                                  Guest Portal
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleContactGuest(guest, 'email')} disabled={!guest.email}>
                                  <Icons.Mail className="mr-2 h-4 w-4" />
                                  Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleContactGuest(guest, 'whatsapp')} disabled={!guest.phone}>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  WhatsApp
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEnrollLoyalty(guest)} disabled={!canManage || guest.loyaltyStatus === 'enrolled'}>
                              <Gift className="mr-2 h-4 w-4" />
                              Enroll in Loyalty Program
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteGuest(guest)} disabled={!canManage} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Guest Modal */}
      <Dialog open={isEditGuestModalOpen} onOpenChange={setIsEditGuestModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Guest</DialogTitle>
            <DialogDescription>
              Update guest information
            </DialogDescription>
          </DialogHeader>
          {selectedGuest && (
            <GuestForm
              onClose={() => setIsEditGuestModalOpen(false)}
              onSave={handleSaveGuest}
              initialData={selectedGuest}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Profile Modal */}
      <Dialog open={isViewProfileModalOpen} onOpenChange={setIsViewProfileModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedGuest ? selectedGuest.fullName : 'Guest Profile'}
            </DialogTitle>
            <DialogDescription>
              Detailed guest information
            </DialogDescription>
          </DialogHeader>
          {selectedGuest && (
            <GuestProfile 
              guest={selectedGuest} 
              allReservations={reservations}
              onGuestDeleted={() => {
                setIsViewProfileModalOpen(false);
                setSelectedGuest(null);
                // Refresh the guests list
                window.location.reload();
              }}
              onReservationCreated={handleReservationCreated}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guest{selectedRowIds.size > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRowIds.size > 1 
                ? `Are you sure you want to delete ${selectedRowIds.size} guests? This action cannot be undone.`
                : `Are you sure you want to delete this guest? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={selectedRowIds.size > 0 ? confirmBulkDelete : confirmDelete} 
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
