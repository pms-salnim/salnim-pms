
"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import StaffFilters from "@/components/staff/staff-filters";
import StaffList from "@/components/staff/staff-list";
import type { StaffMember, StaffRole, Permissions, StaffStatus } from '@/types/staff';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { db, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/types/firestoreUser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { defaultPermissions } from '@/types/staff';
import { useTranslation } from 'react-i18next';

const StaffForm = dynamic(() => import('@/components/staff/staff-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});
const StaffProfileModal = dynamic(() => import('@/components/staff/staff-profile-modal'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

// This type is specific to this page for managing login-enabled users
interface AuthStaffMember extends StaffMember {
  id: string; // Firebase Auth UID
  email: string;
  permissions: Permissions;
  lastLogin?: string;
  // It includes all fields from StaffMember, but some might be unused if separating concerns
}

export default function AllStaffPage() {
  const { user: currentUser, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/staff/all/content');
  const [staffMembers, setStaffMembers] = useState<AuthStaffMember[]>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AuthStaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserPropertyId, setCurrentUserPropertyId] = useState<string | null>(null);
  const canManageStaff = currentUser?.permissions?.staffManagement;

  const [isViewProfileModalOpen, setIsViewProfileModalOpen] = useState(false);
  const [viewingStaff, setViewingStaff] = useState<AuthStaffMember | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<AuthStaffMember | null>(null);

  useEffect(() => {
    if (currentUser?.propertyId) {
        setCurrentUserPropertyId(currentUser.propertyId);
    }
  }, [currentUser?.propertyId]);

  useEffect(() => {
    if (!currentUserPropertyId) {
      setStaffMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const staffColRef = collection(db, "staff");
    // This query might need adjustment if we truly separate User and Staff collections
    const q = query(staffColRef, where("propertyId", "==", currentUserPropertyId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStaff = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data();
          // Filter for records that are actual users with login capabilities
          if (!data.email || !data.permissions) return null;

          return {
            id: docSnap.id,
            fullName: data.fullName || (data.firstName || '') + ' ' + (data.lastName || '').trim(),
            email: data.email,
            phone: data.phone,
            role: data.role,
            status: data.status || 'Active',
            lastLogin: data.lastLogin?.toDate ? data.lastLogin.toDate().toLocaleString() : data.lastLogin,
            propertyId: data.propertyId,
            permissions: data.permissions as Permissions,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as AuthStaffMember;
        })
        .filter((item): item is AuthStaffMember => item !== null);

      setStaffMembers(fetchedStaff);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching staff:", error);
      toast({ title: "Error", description: "Could not fetch staff members.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserPropertyId]);


  const handleAddStaff = () => {
    setEditingStaff(null);
    setIsFormModalOpen(true);
  };

  const handleEditStaff = (staff: AuthStaffMember) => {
    setEditingStaff(staff);
    setIsFormModalOpen(true);
  };

  const handleViewProfile = (staff: AuthStaffMember) => {
    setViewingStaff(staff);
    setIsViewProfileModalOpen(true);
  };

  const handleFormClose = () => {
    setIsFormModalOpen(false);
    setEditingStaff(null);
  };

  const handleFormSave = async (staffData: any) => {
    if (!currentUserPropertyId || !currentUser?.id) {
      toast({ title: "Error", description: "Cannot save staff member. User or property not identified.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    const { id: staffIdFromForm, password, ...formData } = staffData;
    const fullName = (formData.firstName || '') + ' ' + (formData.lastName || '').trim();

    try {
      if (editingStaff && staffIdFromForm) {
        // --- UPDATE EXISTING USER ---
        const staffDocRef = doc(db, "staff", staffIdFromForm);
        const dataToUpdate = {
          ...formData,
          fullName,
          updatedAt: serverTimestamp()
        };
        await updateDoc(staffDocRef, dataToUpdate);
        toast({ title: t('toasts.update_success.title'), description: t('toasts.update_success.description', { name: fullName }) });
      } else {
        // --- CREATE NEW USER ---
        if (!password) {
          throw new Error(t('toasts.new_password_required'));
        }
        
        const functions = getFunctions(app, 'europe-west1');
        const createStaffUser = httpsCallable(functions, 'createStaffUser');

        const requestData = {
          email: formData.email,
          password: password,
          fullName: fullName,
          role: formData.role,
          permissions: formData.permissions,
          propertyId: currentUserPropertyId,
          phone: formData.phone || ""
        };

        const result: any = await createStaffUser(requestData);

        if (result.data.success) {
          toast({ title: t('toasts.create_success.title'), description: t('toasts.create_success.description', { name: fullName }) });
        } else {
          throw new Error(result.data.error || t('toasts.create_error'));
        }
      }
      handleFormClose();
    } catch (error: any) {
      console.error("Error saving staff:", error);
      toast({ title: "Error", description: error.message || t('toasts.save_error'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleStatusStaff = async (staffId: string, currentStatus: StaffStatus) => {
     try {
        const staffDocRef = doc(db, "staff", staffId);
        const newStatus: StaffStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        await updateDoc(staffDocRef, { status: newStatus, updatedAt: serverTimestamp() });
        toast({ title: "Success", description: 'Staff member status updated to ' + newStatus + '.' });
     } catch (error) {
        toast({ title: "Error", description: "Could not update staff status.", variant: "destructive" });
     }
  };

  const handleResetPassword = (staffId: string) => {
    toast({ title: "Password Reset", description: 'Password reset initiated for staff member ' + staffId + '. (Placeholder)' });
  };

  const handleDeleteStaff = (staff: AuthStaffMember) => {
    if (staff.id === currentUser?.id) {
      toast({ title: "Error", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    setStaffToDelete(staff);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteStaff = async () => {
    if (!staffToDelete || !canManageStaff) return;

    if (staffToDelete.id === currentUser?.id) {
        toast({ title: "Error", description: "You cannot delete your own account.", variant: "destructive" });
        setIsDeleteDialogOpen(false);
        setStaffToDelete(null);
        return;
    }

    setIsLoading(true);
    try {
        const functions = getFunctions(app, 'europe-west1');
        const deleteStaffUser = httpsCallable(functions, 'deleteStaffUser');
        const result: any = await deleteStaffUser({ uid: staffToDelete.id });

        if (result.data.success) {
            toast({ title: "Success", description: result.data.message || t('toasts.delete_success') });
        } else {
            throw new Error(result.data.error || "An unknown error occurred on the server.");
        }
    } catch (error: any) {
        console.error("Error deleting staff user:", error);
        toast({ title: "Deletion Failed", description: error.message || t('toasts.delete_error'), variant: "destructive" });
    } finally {
        setIsLoading(false);
        setIsDeleteDialogOpen(false);
        setStaffToDelete(null);
    }
  };

  if (isLoading || isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!canManageStaff) {
     return (
        <div className="space-y-6">
             <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
                {t('title')}
            </h1>
            <Alert variant="destructive" className="mt-4">
              <Icons.AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You do not have permission to manage staff. Please contact an administrator.
              </AlertDescription>
            </Alert>
        </div>
     )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={handleAddStaff} disabled={!canManageStaff}>
          <Icons.PlusCircle className="mr-2 h-4 w-4" /> {t('add_staff_button')}
        </Button>
      </div>

      <StaffFilters 
        onFilterChange={(filters) => console.log("Filters applied (placeholder):", filters)} 
      />
      <StaffList
        staffMembers={staffMembers}
        onEditStaff={handleEditStaff as any}
        onToggleStatus={handleToggleStatusStaff}
        onResetPassword={handleResetPassword}
        onViewProfile={handleViewProfile as any}
        onDeleteStaff={handleDeleteStaff as any}
        canManage={canManageStaff}
        t={t}
      />

      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStaff ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
            <DialogDescription>
              {editingStaff ? t('edit_modal.description') : t('add_modal.description')}
            </DialogDescription>
          </DialogHeader>
          <StaffForm
            initialData={editingStaff}
            onClose={handleFormClose}
            onSave={handleFormSave}
            currentUserRole={currentUser?.role || 'staff'}
            currentUserPermissions={currentUser?.permissions || defaultPermissions}
          />
        </DialogContent>
      </Dialog>

      {viewingStaff && (
        <StaffProfileModal
          isOpen={isViewProfileModalOpen}
          onClose={() => { setIsViewProfileModalOpen(false); setViewingStaff(null); }}
          staffMember={viewingStaff}
        />
      )}
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { name: staffToDelete?.fullName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaffToDelete(null)}>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStaff}>{t('delete_dialog.continue_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
