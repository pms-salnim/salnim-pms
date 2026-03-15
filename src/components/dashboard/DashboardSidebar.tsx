"use client";

import React from "react";
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { toDate } from '@/lib/dateUtils';
import { History as LucideHistory, UserPlus as LucideUserPlus, Clock as LucideClock, ChevronRight as LucideChevronRight } from 'lucide-react';
import HousekeepingWidgetV2 from "@/components/dashboard/housekeeping-widget-v2";
import type { Property } from '@/types/property';
import type { Reservation } from "@/components/calendar/types";

interface DashboardSidebarProps {
  propertyId: string | null;
  propertySettings: Property | null;
  vips: any[];
  guestRequests: any[];
  recentReservations: Reservation[];
}

export function DashboardSidebar({ 
  propertyId, 
  propertySettings, 
  vips, 
  guestRequests, 
  recentReservations 
}: DashboardSidebarProps) {
  const { t } = useTranslation('pages/dashboard/content');
  return (
    <div className="space-y-6">
      <HousekeepingWidgetV2 propertyId={propertyId} propertySettings={propertySettings} />
    </div>
  );
}
