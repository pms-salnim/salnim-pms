
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { StaffMember, AppModuleKey } from '@/types/staff';
import { appModules } from '@/types/staff';
import { useTranslation } from 'react-i18next';

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
}

export default function StaffProfileModal({ isOpen, onClose, staffMember }: StaffProfileModalProps) {
  const { t } = useTranslation('pages/staff/all/content');
  if (!staffMember) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('profile_modal.title', { name: staffMember.fullName })}</DialogTitle>
          <DialogDescription>
            {t('profile_modal.description', { email: staffMember.email })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.name_label')}:</Label>
            <p className="text-muted-foreground">{staffMember.fullName}</p>
          </div>
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.email_label')}:</Label>
            <p className="text-muted-foreground">{staffMember.email}</p>
          </div>
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.phone_label')}:</Label>
            <p className="text-muted-foreground">{staffMember.phone || t('profile_modal.not_provided')}</p>
          </div>
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.role_label')}:</Label>
            <p className="text-muted-foreground capitalize">{staffMember.role}</p>
          </div>
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.status_label')}:</Label>
            <div>
                <Badge variant={staffMember.status === "Active" ? "default" : "outline"}
                       className={staffMember.status === "Active" ? "bg-green-500 hover:bg-green-600 text-white" : "border-yellow-500 text-yellow-700"}>
                  {staffMember.status}
                </Badge>
            </div>
          </div>
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.last_login_label')}:</Label>
            <p className="text-muted-foreground">{staffMember.lastLogin || t('profile_modal.not_provided')}</p>
          </div>
          <div>
            <Label className="font-semibold text-foreground">{t('profile_modal.permissions_label')}:</Label>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                {appModules.map((moduleInfo) => {
                    const moduleKey = moduleInfo.key as AppModuleKey;
                    if (staffMember.permissions[moduleKey]) {
                        return <li key={moduleKey}>{t(moduleInfo.labelKey)}</li>;
                    }
                    return null;
                })}
                {Object.values(staffMember.permissions).every(p => !p) && <li>{t('profile_modal.no_permissions')}</li>}
            </ul>
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">{t('profile_modal.buttons.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
