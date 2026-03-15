
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { staffRoles, type StaffRole } from "@/types/staff";
import { useTranslation } from "react-i18next";

interface StaffFiltersProps {
  onFilterChange: (filters: { searchTerm?: string; role?: StaffRole | 'all'; status?: 'Active' | 'Inactive' | 'all' }) => void;
}

export default function StaffFilters({ onFilterChange }: StaffFiltersProps) {
  const { t } = useTranslation('pages/staff/all/content');
  // In a real app, these would be controlled states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState<StaffRole | 'all'>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<'Active' | 'Inactive' | 'all'>("all");

  const handleApplyFilters = () => {
    onFilterChange({
      searchTerm: searchTerm || undefined,
      role: selectedRole === "all" ? undefined : selectedRole,
      status: selectedStatus === "all" ? undefined : selectedStatus,
    });
  };


  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end gap-4 p-4 border rounded-lg shadow-sm bg-card">
      <Input
        placeholder={t('filters.search_placeholder')}
        className="w-full lg:col-span-2"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as StaffRole | 'all')}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('filters.role_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all_roles')}</SelectItem>
          {staffRoles.map((role) => (
            <SelectItem key={role} value={role}>{t(`roles.${role}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as 'Active' | 'Inactive' | 'all')}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('filters.status_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.all_statuses')}</SelectItem>
          <SelectItem value="Active">{t('statuses.active')}</SelectItem>
          <SelectItem value="Inactive">{t('statuses.inactive')}</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Apply button is optional if filters apply on change, but good for multiple filters */}
       <Button onClick={handleApplyFilters} className="w-full sm:w-auto xl:col-start-4">
        <Icons.Filter className="mr-2 h-4 w-4" />
        {t('filters.apply_button')}
      </Button>
    </div>
  );
}
