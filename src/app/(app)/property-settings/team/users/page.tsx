'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
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

const teamSubtabs = [
  { id: 'users', label: 'Users', href: '/property-settings/team/users' },
  { id: 'roles', label: 'Roles & Permissions', href: '/property-settings/team/roles-permissions' },
  { id: 'security', label: 'Security', href: '/property-settings/team/security' },
];

// This type is specific to this page for managing login-enabled users
interface AuthStaffMember extends StaffMember {
  id: string; // Firebase Auth UID
  email: string;
  permissions: Permissions;
  lastLogin?: string;
  // It includes all fields from StaffMember, but some might be unused if separating concerns
}

export default function UsersPage() {
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

  const fetchTeamMembers = async (propId?: string) => {
    const propertyId = propId || currentUserPropertyId;
    if (!propertyId) {
      setStaffMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/team-members/list?property_id=${propertyId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }
      
      const data = await response.json();
      const transformedMembers = (data.teamMembers || []).map((member: any) => ({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        phone: member.phone,
        role: member.role,
        status: member.status,
        lastLogin: member.lastLogin ? new Date(member.lastLogin).toLocaleString() : undefined,
        propertyId: member.propertyId,
        permissions: member.permissions,
        createdBy: member.createdBy,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      }));
      setStaffMembers(transformedMembers);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({ 
        title: "Error", 
        description: "Could not fetch team members.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUserPropertyId) {
      setStaffMembers([]);
      setIsLoading(false);
      return;
    }

    fetchTeamMembers(currentUserPropertyId);
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
      toast({ 
        title: "Error", 
        description: "Cannot save team member. User or property not identified.", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);

    const { id: staffIdFromForm, password, ...formData } = staffData;
    const fullName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();

    try {
      if (editingStaff && staffIdFromForm) {
        // --- UPDATE EXISTING TEAM MEMBER ---
        const response = await fetch('/api/team-members/crud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            propertyId: currentUserPropertyId,
            data: {
              id: staffIdFromForm,
              fullName,
              email: formData.email,
              phone: formData.phone,
              role: formData.role,
              permissions: formData.permissions,
              status: formData.status,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update team member');
        }

        toast({ 
          title: t('toasts.update_success.title'), 
          description: t('toasts.update_success.description', { name: fullName }) 
        });
        
        handleFormClose();
        // Refetch team members to show the updated user
        await fetchTeamMembers(currentUserPropertyId);
      } else {
        // --- CREATE NEW TEAM MEMBER ---
        if (!password) {
          throw new Error(t('toasts.new_password_required'));
        }

        const response = await fetch('/api/team-members/crud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            propertyId: currentUserPropertyId,
            data: {
              fullName,
              email: formData.email,
              phone: formData.phone || '',
              role: formData.role,
              permissions: formData.permissions,
              status: formData.status || 'Active',
              createdBy: currentUser.id,
              password: password,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create team member');
        }

        toast({ 
          title: t('toasts.create_success.title'), 
          description: t('toasts.create_success.description', { name: fullName }) 
        });
        
        handleFormClose();
        // Refetch team members to show the newly created user
        await fetchTeamMembers(currentUserPropertyId);
      }
    } catch (error: any) {
      console.error("Error saving team member:", error);
      toast({ 
        title: "Error", 
        description: error.message || t('toasts.save_error'), 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleStatusStaff = async (staffId: string, currentStatus: StaffStatus) => {
    try {
      const newStatus: StaffStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      
      const response = await fetch('/api/team-members/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          propertyId: currentUserPropertyId,
          data: {
            id: staffId,
            status: newStatus,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      toast({ 
        title: "Success", 
        description: `Team member status updated to ${newStatus}.` 
      });
      
      // Refetch team members to show updated status
      await fetchTeamMembers(currentUserPropertyId);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({ 
        title: "Error", 
        description: "Could not update team member status.", 
        variant: "destructive" 
      });
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
      toast({ 
        title: "Error", 
        description: "You cannot delete your own account.", 
        variant: "destructive" 
      });
      setIsDeleteDialogOpen(false);
      setStaffToDelete(null);
      return;
    }

    if (!currentUserPropertyId) {
      toast({ 
        title: "Error", 
        description: "Property ID not found. Please refresh and try again.", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/team-members/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          propertyId: currentUserPropertyId,
          data: {
            id: staffToDelete.id,
          },
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData?.details || responseData?.error || 'Failed to delete team member';
        throw new Error(errorMessage);
      }

      toast({ 
        title: "Success", 
        description: t('toasts.delete_success') 
      });
      
      // Refetch team members to remove the deleted user
      await fetchTeamMembers(currentUserPropertyId);
    } catch (error: any) {
      console.error("Error deleting team member:", error);
      const errorMessage = error?.message || "Could not delete team member";
      toast({ 
        title: "Deletion Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
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
             <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          </div>
          <PropertySettingsSubtabs subtabs={teamSubtabs} />
        </div>
      </div>
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage property-organization Users and their access levels and permissions</p>
          </div>
          <PropertySettingsSubtabs subtabs={teamSubtabs} />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Button onClick={handleAddStaff} disabled={!canManageStaff}>
              <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
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
    </div>
  );
}
