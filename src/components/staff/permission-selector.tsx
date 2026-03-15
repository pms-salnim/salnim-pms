
"use client";

import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Permissions, AppModuleKey, StaffRole } from '@/types/staff';
import { appModules, defaultPermissions } from '@/types/staff'; 
import { useTranslation } from 'react-i18next';

interface PermissionSelectorProps {
  permissions: Permissions;
  onPermissionChange: (module: AppModuleKey, value: boolean) => void;
  currentRole: StaffRole; 
  isCurrentUserAdmin: boolean;
  currentUserPermissions: Permissions;
}

export default function PermissionSelector({ permissions, onPermissionChange, currentRole, isCurrentUserAdmin, currentUserPermissions }: PermissionSelectorProps) {
  const { t } = useTranslation('pages/staff/all/content');
  
  const getRoleBasedPermissions = (role: StaffRole): Partial<Permissions> => {
    switch (role) {
      case 'admin':
        const allAdminPerms: Partial<Permissions> = {};
        appModules.forEach(mod => allAdminPerms[mod.key] = true);
        return allAdminPerms;
      case 'manager':
        return { ...defaultPermissions, rooms: true, reservations: true, guests: true, ratePlans: true, finance: true, availability: true, reports: true, housekeeping: true, extras: true };
      case 'frontDesk':
        return { ...defaultPermissions, reservations: true, guests: true, availability: true, extras: true };
      case 'housekeeping':
        return { ...defaultPermissions, rooms: true, availability: true, housekeeping: true };
      default: // 'staff' or other custom roles
        return { ...defaultPermissions }; // Start with no permissions for generic staff
    }
  };

  React.useEffect(() => {
    // This effect should only run when the role changes, to reset permissions to that role's default
    // It should not run on every render or when permissions themselves change.
    const roleDefaults = getRoleBasedPermissions(currentRole);
    
    // Create a new permissions object based on the defaults for the selected role
    const newPermissionsState = { ...defaultPermissions };
    appModules.forEach(moduleInfo => {
      if (typeof roleDefaults[moduleInfo.key] === 'boolean') {
        newPermissionsState[moduleInfo.key] = roleDefaults[moduleInfo.key]!;
      }
    });

    // Update parent state for each key
    Object.keys(newPermissionsState).forEach(key => {
        onPermissionChange(key as AppModuleKey, newPermissionsState[key as AppModuleKey]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-1">
      {appModules.map((moduleInfo) => {
        const moduleKey = moduleInfo.key;
        let isDisabled = false;

        // General rule: A non-admin cannot grant a permission they do not possess.
        if (!isCurrentUserAdmin && !currentUserPermissions[moduleKey]) {
            isDisabled = true;
        }

        // Stricter rules for sensitive permissions, which can override the general rule.
        if (moduleKey === 'staffManagement' || moduleKey === 'settings') {
            // Rule 1: These permissions can only be toggled for the 'admin' role.
            if (currentRole !== 'admin') {
                isDisabled = true;
            }
            // Rule 2: And only an admin can grant them.
            if (!isCurrentUserAdmin) {
                isDisabled = true;
            }
        }
        
        return (
          <div key={moduleKey} className="flex items-center space-x-2 justify-between p-2 border rounded-md bg-background hover:bg-muted/50">
            <Label htmlFor={`perm-${moduleKey}`} className="text-sm font-medium cursor-pointer">
              {t(moduleInfo.labelKey)}
            </Label>
            <Switch
              id={`perm-${moduleKey}`}
              checked={permissions[moduleKey]}
              onCheckedChange={(value) => onPermissionChange(moduleKey, value)}
              disabled={isDisabled}
              aria-label={`Toggle ${t(moduleInfo.labelKey)} permission`}
            />
          </div>
        );
      })}
       {((currentRole === 'admin' && !isCurrentUserAdmin && (permissions.staffManagement || permissions.settings))) && (
         <p className="text-xs text-destructive md:col-span-2 lg:col-span-3">
           {t('permissions.staff_management_admin_note')}
         </p>
      )}
    </div>
  );
}
