'use client';

import React, { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { appModules, type Permissions } from '@/types/staff';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';

const teamSubtabs = [
  { id: 'users', label: 'Users', href: '/property-settings/team/users' },
  { id: 'roles', label: 'Roles & Permissions', href: '/property-settings/team/roles-permissions' },
  { id: 'security', label: 'Security', href: '/property-settings/team/security' },
];

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  status: 'active' | 'inactive';
  propertyId: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function RolesPage() {
  const { user: currentUser, isLoadingAuth } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserPropertyId, setCurrentUserPropertyId] = useState<string | null>(null);
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '',
    permissions: {} as Permissions,
  });

  const canManageRoles = currentUser?.permissions?.staffManagement;

  useEffect(() => {
    if (currentUser?.propertyId) {
      setCurrentUserPropertyId(currentUser.propertyId);
    }
  }, [currentUser?.propertyId]);

  // Extracted fetch function for reusability
  const fetchRoles = async (propertyId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/roles/list?property_id=${encodeURIComponent(propertyId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const { roles: fetchedRoles } = await response.json();
      setRoles(fetchedRoles || []);
    } catch (error: any) {
      console.error('Error fetching roles:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch roles.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUserPropertyId) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    fetchRoles(currentUserPropertyId);
  }, [currentUserPropertyId]);

  const handleAddRoleClick = () => {
    setEditingRole(null);
    // Initialize with empty permissions
    const emptyPermissions: Permissions = {};
    appModules.forEach(module => {
      emptyPermissions[module.key] = false;
    });
    setFormData({ name: '', description: '', permissions: emptyPermissions });
    setIsAddRoleDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({ 
      name: role.name, 
      description: role.description,
      permissions: role.permissions || {},
    });
    setIsAddRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Role name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUserPropertyId) {
      toast({
        title: 'Error',
        description: 'Property not identified.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      let response;

      if (editingRole) {
        // Update existing role
        response = await fetch('/api/roles/crud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            data: {
              id: editingRole.id,
              propertyId: currentUserPropertyId,
              name: formData.name,
              description: formData.description,
              permissions: formData.permissions,
              status: editingRole.status,
            },
          }),
        });
      } else {
        // Create new role
        response = await fetch('/api/roles/crud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            data: {
              propertyId: currentUserPropertyId,
              name: formData.name,
              description: formData.description,
              permissions: formData.permissions,
              status: 'active',
            },
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save role');
      }

      const successMessage = editingRole
        ? 'Role updated successfully.'
        : 'Role created successfully.';
      toast({ title: 'Success', description: successMessage });
      
      setIsAddRoleDialogOpen(false);
      const emptyPermissions: Permissions = {};
      appModules.forEach(module => {
        emptyPermissions[module.key] = false;
      });
      setFormData({ name: '', description: '', permissions: emptyPermissions });
      setEditingRole(null);
      
      // ✅ Refetch roles after saving
      await fetchRoles(currentUserPropertyId);
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not save role.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (role: Role) => {
    if (!currentUserPropertyId) return;

    try {
      const newStatus = role.status === 'active' ? 'inactive' : 'active';
      
      const response = await fetch('/api/roles/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          data: {
            id: role.id,
            propertyId: currentUserPropertyId,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            status: newStatus,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role status');
      }

      toast({
        title: 'Success',
        description: `Role status changed to ${newStatus}.`,
      });
      
      // ✅ Refetch roles after status change
      await fetchRoles(currentUserPropertyId);
    } catch (error: any) {
      console.error('Error updating role status:', error);
      toast({
        title: 'Error',
        description: 'Could not update role status.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRole = (role: Role) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete || !currentUserPropertyId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/roles/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          data: {
            id: roleToDelete.id,
            propertyId: currentUserPropertyId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete role');
      }

      toast({ title: 'Success', description: 'Role deleted successfully.' });
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      
      // ✅ Refetch roles after deletion
      await fetchRoles(currentUserPropertyId);
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not delete role.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || isLoadingAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure role-based access controls</p>
          </div>
          <PropertySettingsSubtabs subtabs={teamSubtabs} />
        </div>
        <div className="flex justify-between items-center">
          <Button onClick={handleAddRoleClick} disabled={!canManageRoles}>
            <Icons.PlusCircle className="mr-2 h-4 w-4" /> Add Role
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {roles.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <Icons.FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No roles found</h3>
              <p className="text-sm text-muted-foreground mt-1">Create your first role to get started</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/30">
                  <TableHead className="border-r border-slate-50 h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="border-r border-slate-50 h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="border-r border-slate-50 h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="border-r border-slate-50 h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Permissions
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="border-r border-slate-50 px-4 py-3">
                      <Switch
                        checked={role.status === 'active'}
                        onCheckedChange={() => handleToggleStatus(role)}
                        disabled={!canManageRoles}
                      />
                    </TableCell>
                    <TableCell className="border-r border-slate-50 px-4 py-3">
                      <span className="font-medium">{role.name}</span>
                    </TableCell>
                    <TableCell className="border-r border-slate-50 px-4 py-3">
                      <span className="text-sm text-muted-foreground">{role.description || '-'}</span>
                    </TableCell>
                    <TableCell className="border-r border-slate-50 px-4 py-3">
                      <span className="text-sm">
                        {Object.values(role.permissions || {}).filter(Boolean).length} of {appModules.length}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditRole(role)}
                            disabled={!canManageRoles}
                          >
                            <Icons.Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteRole(role)}
                            disabled={!canManageRoles}
                            className="text-red-600"
                          >
                            <Icons.Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Role Dialog */}
      <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Update the role details' : 'Create a new role for your team'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                placeholder="e.g., Hotel Manager"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                placeholder="Describe the purpose of this role..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>
            
            {/* Permissions Section */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-3 block">Permissions</Label>
              <p className="text-sm text-muted-foreground mb-3">Select which modules this role can access</p>
              <div className="grid grid-cols-2 gap-3">
                {appModules.map((module) => (
                  <div key={module.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`permission-${module.key}`}
                      checked={formData.permissions[module.key] || false}
                      onCheckedChange={(checked) => {
                        setFormData({
                          ...formData,
                          permissions: {
                            ...formData.permissions,
                            [module.key]: checked,
                          },
                        });
                      }}
                    />
                    <Label 
                      htmlFor={`permission-${module.key}`}
                      className="font-normal cursor-pointer text-sm"
                    >
                      {module.labelKey}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              {editingRole ? 'Update' : 'Create'} Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
