
"use client";

import React, { useState, useEffect } from "react";
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
import { useTranslation } from 'react-i18next';
import type { RoomType } from "@/types/roomType";

interface RatePlanFiltersProps {
  roomTypes: RoomType[];
  onFilterChange: (filters: {
    searchTerm: string;
    roomTypeId: string;
    status: string;
  }) => void;
}

export default function RatePlanFilters({ roomTypes, onFilterChange }: RatePlanFiltersProps) {
  const { t } = useTranslation('pages/rate-plans/all/content');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoomType, setSelectedRoomType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    // A small debounce could be useful here in a real app
    const filters = {
      searchTerm,
      roomTypeId: selectedRoomType,
      status: selectedStatus,
    };
    onFilterChange(filters);
  }, [searchTerm, selectedRoomType, selectedStatus, onFilterChange]);

  return (
    <div className="flex flex-col sm:flex-row items-end gap-2 md:gap-4 p-4 border rounded-lg shadow-sm bg-card">
      <div className="flex-grow space-y-1 w-full">
        <label htmlFor="ratePlanSearch" className="text-xs font-medium text-muted-foreground">Search Rate Plan</label>
        <Input
          id="ratePlanSearch"
          placeholder={t('filters.search_placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="w-full sm:w-auto space-y-1">
        <label htmlFor="roomTypeFilter" className="text-xs font-medium text-muted-foreground">{t('filters.room_type_label')}</label>
        <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
          <SelectTrigger id="roomTypeFilter" className="w-full sm:min-w-[180px]">
            <SelectValue placeholder={t('filters.room_type_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all_room_types')}</SelectItem>
            {roomTypes.map(rt => (
                <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
       <div className="w-full sm:w-auto space-y-1">
        <label htmlFor="statusFilter" className="text-xs font-medium text-muted-foreground">{t('filters.status_label')}</label>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger id="statusFilter" className="w-full sm:min-w-[150px]">
            <SelectValue placeholder={t('filters.status_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all_statuses')}</SelectItem>
            <SelectItem value="active">{t('filters.active')}</SelectItem>
            <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
