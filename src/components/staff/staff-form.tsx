
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { StaffMember, StaffRole, Permissions } from '@/types/staff';
import { staffRoles } from '@/types/staff';
import PermissionSelector from './permission-selector';
import { defaultPermissions } from '@/types/staff';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';

interface StaffFormProps {
  initialData: StaffMember | null;
  onClose: () => void;
  onSave: (staffData: Omit<StaffMember, 'id' | 'fullName' | 'propertyId' | 'lastLogin' | 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string; password?: string }) => void;
  currentUserRole: StaffRole;
  currentUserPermissions: Permissions;
}

export default function StaffForm({ initialData, onClose, onSave, currentUserRole, currentUserPermissions }: StaffFormProps) {
  const { t } = useTranslation('pages/staff/all/content');
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('Front Desk');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);

  const isEditingSelf = initialData?.id === user?.id;

  useEffect(() => {
    if (initialData) {
      const nameParts = initialData.fullName?.split(' ') || [];
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setRole(initialData.role);
      setStatus(initialData.status);
      setPermissions(initialData.permissions);
      setPassword(''); // Password should be reset/set explicitly, not pre-filled for editing
    } else {
      // Reset to defaults for new staff
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRole('Front Desk');
      setStatus('Active');
      setPassword('');
      setPermissions(defaultPermissions);
    }
  }, [initialData]);

  const handlePermissionChange = (module: keyof Permissions, value: boolean) => {
    setPermissions(prev => ({ ...prev, [module]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName || !lastName || !email || (!initialData && !password) || (initialData && password && password.length < 6)) {
      alert('Please fill all required fields. Password must be at least 6 characters if setting a new one.');
      return;
    }
    
    const staffDataToSave: Omit<StaffMember, 'id' | 'fullName' | 'propertyId' | 'lastLogin' | 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string; password?: string } = {
      id: initialData?.id,
      firstName,
      lastName,
      email,
      phone: phone || '',
      role,
      status,
      permissions,
    };

    if (password) { // Only include password if it's being set/changed
        staffDataToSave.password = password;
    }
    
    onSave(staffDataToSave);
  };

  const generatePassword = () => {
    const randomPassword = Math.random().toString(36).slice(-8);
    setPassword(randomPassword);
    alert(`Generated password: ${randomPassword}. Make sure to copy it.`);
  };
  
  const availableRoles = currentUserRole === 'admin' 
    ? staffRoles 
    : staffRoles.filter(r => r !== 'admin');

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-2">
      {/* Personal Info */}
      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.personal_info')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="firstName">{t('form.first_name_label')}</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('form.first_name_placeholder')} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lastName">{t('form.last_name_label')}</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('form.last_name_placeholder')} required />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">{t('form.email_label')}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('form.email_placeholder')} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">{t('form.phone_label')}</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('form.phone_placeholder')} />
        </div>
      </section>

      {/* Account Access */}
      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.account_access')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <Label htmlFor="role">{t('form.role_label')}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as StaffRole)} disabled={isEditingSelf}>
              <SelectTrigger id="role">
                <SelectValue placeholder={t('form.role_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(r => <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            {isEditingSelf && <p className="text-xs text-muted-foreground">{t('cannot_edit_own_role')}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">{t('form.status_label')}</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as 'Active' | 'Inactive')}>
              <SelectTrigger id="status">
                <SelectValue placeholder={t('form.status_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">{t('statuses.active')}</SelectItem>
                <SelectItem value="Inactive">{t('statuses.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{initialData ? t('form.password_label_edit') : t('form.password_label_new')}</Label>
          <div className="flex gap-2">
            <Input id="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={initialData ? t('form.password_placeholder_edit') : t('form.password_placeholder_new')} />
            <Button type="button" variant="outline" onClick={generatePassword}>{t('form.generate_button')}</Button>
          </div>
           {!initialData && <p className="text-xs text-muted-foreground">{t('form.password_info_new')}</p>}
           {initialData && <p className="text-xs text-muted-foreground">{t('form.password_info_edit')}</p>}
        </div>
        <div className="space-y-1">
            <Label htmlFor="propertyId">{t('form.property_label')}</Label>
            <Input id="propertyId" value={t('form.property_value')} disabled className="bg-muted/50" />
             <p className="text-xs text-muted-foreground">{t('form.property_info')}</p>
        </div>
      </section>

      {/* Permissions */}
      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground border-b pb-1.5">{t('form.sections.permissions')}</h3>
        <PermissionSelector 
            permissions={permissions} 
            onPermissionChange={handlePermissionChange}
            currentRole={role}
            isCurrentUserAdmin={currentUserRole === 'Admin'}
            currentUserPermissions={currentUserPermissions}
        />
      </section>

      <DialogFooter className="pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('form.buttons.cancel')}
          </Button>
        </DialogClose>
        <Button type="submit">{t('form.buttons.save')}</Button>
      </DialogFooter>
    </form>
  );
}
