
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { Guest } from '@/types/guest';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LoyaltyList from '@/components/guests/loyalty-list';
import LoyaltyAdjustForm from '@/components/guests/loyalty-adjust-form';
import BulkLoyaltyAdjustForm from '@/components/guests/bulk-loyalty-adjust-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from 'react-i18next';
import GuestProfile from '@/components/guests/guest-profile'; // New Import
import type { Reservation } from '@/components/calendar/types';
import type { Timestamp } from 'firebase/firestore';

export default function LoyaltyPage() {
  const { user, property, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/guests/loyalty/content');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for bulk actions
  const [selectedRowIds, setSelectedRowIds] = useState(new Set<string>());
  const [isBulkAdjustModalOpen, setIsBulkAdjustModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isViewProfileModalOpen, setIsViewProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.propertyId || !property?.loyaltyProgramSettings?.enabled) {
      setIsLoadingGuests(false);
      setGuests([]);
      return;
    }

    setIsLoadingGuests(true);
    const guestsColRef = collection(db, "guests");
    const q = query(
      guestsColRef, 
      where("propertyId", "==", user.propertyId),
      where("loyaltyStatus", "==", "enrolled") // Only fetch enrolled guests
    );

    const unsubGuests = onSnapshot(q, (snapshot) => {
      const fetchedGuests = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as Guest));
      setGuests(fetchedGuests);
      setIsLoadingGuests(false);
    }, (error) => {
      console.error("Error fetching guests:", error);
      toast({ title: "Error", description: "Could not fetch guests.", variant: "destructive" });
      setIsLoadingGuests(false);
    });

    return () => {
        unsubGuests();
    };
  }, [user?.propertyId, property?.loyaltyProgramSettings?.enabled]);

  const handleAdjustPoints = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsModalOpen(true);
  };
  
  const handleViewProfile = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsViewProfileModalOpen(true);
  };

  const handleSavePoints = async (pointsChange: number, reason: string) => {
    if (!selectedGuest) return;
    
    const guestRef = doc(db, "guests", selectedGuest.id);
    const historyRef = doc(collection(db, "guests", selectedGuest.id, "loyaltyHistory"));

    const batch = writeBatch(db);
    batch.update(guestRef, {
        loyaltyPoints: increment(pointsChange),
        ...(pointsChange > 0 && { totalPointsEarned: increment(pointsChange) }),
        ...(pointsChange < 0 && { totalPointsRedeemed: increment(Math.abs(pointsChange)) })
    });
    batch.set(historyRef, {
        date: serverTimestamp(),
        change: pointsChange,
        reason: reason,
        staffName: user?.name || "System"
    });

    try {
        await batch.commit();
        toast({ title: "Success", description: `Points updated for ${selectedGuest.fullName}.` });
    } catch (error) {
        console.error("Error updating points:", error);
        toast({ title: "Error", description: "Could not update points.", variant: "destructive" });
    } finally {
        setIsModalOpen(false);
        setSelectedGuest(null);
    }
  };

  const handleSaveBulkPoints = async (pointsChange: number, reason: string) => {
    if (selectedRowIds.size === 0) return;
    setIsLoadingGuests(true);
    const batch = writeBatch(db);
    selectedRowIds.forEach(id => {
      const guestRef = doc(db, "guests", id);
      const historyRef = doc(collection(db, "guests", id, "loyaltyHistory"));
      batch.update(guestRef, {
        loyaltyPoints: increment(pointsChange),
        ...(pointsChange > 0 && { totalPointsEarned: increment(pointsChange) }),
        ...(pointsChange < 0 && { totalPointsRedeemed: increment(Math.abs(pointsChange)) })
      });
      batch.set(historyRef, {
        date: serverTimestamp(),
        change: pointsChange,
        reason: `(Bulk) ${reason}`,
        staffName: user?.name || "System"
      });
    });

    try {
      await batch.commit();
      toast({ title: "Success", description: `Points adjusted for ${selectedRowIds.size} guests.`});
    } catch(err) {
      console.error("Error in bulk point adjustment:", err);
      toast({ title: "Error", description: "Could not adjust points for all guests.", variant: "destructive" });
    } finally {
      setIsLoadingGuests(false);
      setIsBulkAdjustModalOpen(false);
      setSelectedRowIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowIds.size === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedRowIds.size === 0) return;
    setIsLoadingGuests(true);
    const batch = writeBatch(db);
    selectedRowIds.forEach(id => {
      batch.delete(doc(db, "guests", id));
    });

    try {
      await batch.commit();
      toast({ title: "Success", description: `${selectedRowIds.size} guest(s) deleted.` });
    } catch (error) {
      console.error("Error bulk deleting guests:", error);
      toast({ title: "Error", description: "Could not delete all selected guests.", variant: "destructive" });
    } finally {
      setIsLoadingGuests(false);
      setIsBulkDeleteModalOpen(false);
      setSelectedRowIds(new Set());
    }
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user?.permissions?.guests) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view this page. Please contact an administrator.
        </AlertDescription>
      </Alert>
    );
  }

  if (!property?.loyaltyProgramSettings?.enabled) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
        </div>
        <Alert>
          <Icons.Star className="h-4 w-4" />
          <AlertTitle>{t('not_active.title')}</AlertTitle>
          <AlertDescription>
            {t('not_active.description')}
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/settings/property">{t('not_active.go_to_settings')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
        </div>
        
        <LoyaltyList 
            guests={guests} 
            isLoading={isLoadingGuests}
            onAdjustPoints={handleAdjustPoints}
            onViewProfile={handleViewProfile}
            selectedRowIds={selectedRowIds}
            onRowSelect={(guestId) => {
                const newSet = new Set(selectedRowIds);
                if (newSet.has(guestId)) newSet.delete(guestId);
                else newSet.add(guestId);
                setSelectedRowIds(newSet);
            }}
            onSelectAll={(checked) => {
                if (checked) setSelectedRowIds(new Set(guests.map(g => g.id)));
                else setSelectedRowIds(new Set());
            }}
            onBulkAdjustPoints={() => setIsBulkAdjustModalOpen(true)}
            onBulkDelete={handleBulkDelete}
            canManage={user?.permissions?.guests}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adjust_modal.title')}</DialogTitle>
            <DialogDescription>
              {t('adjust_modal.description', { name: selectedGuest?.fullName })}
            </DialogDescription>
          </DialogHeader>
          <LoyaltyAdjustForm
            currentPoints={selectedGuest?.loyaltyPoints || 0}
            onSave={handleSavePoints}
            onClose={() => setIsModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isBulkAdjustModalOpen} onOpenChange={setIsBulkAdjustModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('bulk_adjust_modal.title')}</DialogTitle>
                <DialogDescription>
                    {t('bulk_adjust_modal.description', { count: selectedRowIds.size })}
                </DialogDescription>
            </DialogHeader>
            <BulkLoyaltyAdjustForm 
                onSave={handleSaveBulkPoints}
                onClose={() => setIsBulkAdjustModalOpen(false)}
            />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{t('bulk_delete_dialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                    {t('bulk_delete_dialog.description', { count: selectedRowIds.size })}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsBulkDeleteModalOpen(false)}>{t('bulk_delete_dialog.cancel_button')}</AlertDialogCancel>
                <AlertDialogAction onClick={confirmBulkDelete}>{t('bulk_delete_dialog.continue_button')}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isViewProfileModalOpen} onOpenChange={(isOpen) => { setIsViewProfileModalOpen(isOpen); if (!isOpen) setSelectedGuest(null); }}>
        <DialogContent className="sm:max-w-3xl"> 
          <DialogHeader>
            <DialogTitle>{t('profile.title', { name: selectedGuest?.fullName })}</DialogTitle>
            <DialogDescription>
              {t('profile.description')}
            </DialogDescription>
          </DialogHeader>
          {selectedGuest && <GuestProfile guest={selectedGuest} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
