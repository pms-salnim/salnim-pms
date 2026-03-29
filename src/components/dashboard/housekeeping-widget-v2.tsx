"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, limit, orderBy, Timestamp } from 'firebase/firestore';
import type { Property } from '@/types/property';
import type { Room } from '@/types/room';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const BRAND_COLOR = '#003166';

interface HousekeepingWidgetV2Props {
  propertyId: string | null;
  propertySettings: Property | null;
}

interface HousekeepingTask {
  id: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'unassigned';
  priority?: string;
  roomName?: string;
  assignedTo?: string;
  createdAt?: Timestamp;
  completionTime?: number;
}

export default function HousekeepingWidgetV2({ propertyId, propertySettings }: HousekeepingWidgetV2Props) {
  const { t } = useTranslation('components/dashboard/housekeeping-widget');
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState({
    cleanRooms: 0,
    dirtyRooms: 0,
    inProgressRooms: 0,
    unassignedTasks: 0,
  });
  const [recentCompletions, setRecentCompletions] = useState<HousekeepingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    // Fetch rooms data
    const roomsQuery = query(
      collection(db, 'rooms'),
      where('propertyId', '==', propertyId)
    );

    const unsubscribeRooms = onSnapshot(roomsQuery, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomsData);

      // Calculate metric stats based on room status
      const cleanRooms = roomsData.filter(r => r.cleaningStatus === 'clean').length;
      const dirtyRooms = roomsData.filter(r => r.cleaningStatus === 'dirty').length;
      const inProgressRooms = roomsData.filter(r => r.cleaningStatus === 'in_progress').length;

      setStats(prev => ({
        ...prev,
        cleanRooms,
        dirtyRooms,
        inProgressRooms,
      }));

      setIsLoading(false);
    });

    return () => unsubscribeRooms();
  }, [propertyId]);

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND_COLOR }}></div>
          <h2 className="text-sm font-bold text-slate-800">Housekeeping Dashboard</h2>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-xs h-7"
        >
          <Link href="/housekeeping/operations-dashboard">
            View All
          </Link>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Clean Card */}
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Clean</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.cleanRooms}</p>
          <p className="text-[9px] text-emerald-500 mt-0.5">Ready</p>
        </div>
        
        {/* Dirty Card */}
        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <p className="text-[10px] text-yellow-700 font-semibold uppercase tracking-wide">Dirty</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.dirtyRooms}</p>
          <p className="text-[9px] text-yellow-600 mt-0.5">Need Clean</p>
        </div>
        
        {/* In Progress Card */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Progress</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.inProgressRooms}</p>
          <p className="text-[9px] text-blue-500 mt-0.5">Cleaning</p>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4">
        <Button
          asChild
          size="sm"
          className="w-full text-xs h-8"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          <Link href="/housekeeping/attendant-worksheets">
            Manage Housekeeping
          </Link>
        </Button>
      </div>
    </section>
  );
}
