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
    <section className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2">
        <h2 className="text-xs font-bold text-white">Housekeeping</h2>
      </div>

      {/* Compact Metric Cards */}
      <div className="px-3 py-3 grid grid-cols-3 gap-2">
        {/* Clean Card */}
        <div className="bg-white border border-emerald-200 rounded p-2 text-center">
          <p className="text-2xl font-black text-emerald-700">{stats.cleanRooms}</p>
          <p className="text-[8px] text-emerald-600 font-semibold mt-1">Clean</p>
        </div>
        
        {/* Dirty Card */}
        <div className="bg-white border border-amber-200 rounded p-2 text-center">
          <p className="text-2xl font-black text-amber-700">{stats.dirtyRooms}</p>
          <p className="text-[8px] text-amber-600 font-semibold mt-1">Dirty</p>
        </div>
        
        {/* In Progress Card */}
        <div className="bg-white border border-blue-200 rounded p-2 text-center">
          <p className="text-2xl font-black text-blue-700">{stats.inProgressRooms}</p>
          <p className="text-[8px] text-blue-600 font-semibold mt-1">In Progress</p>
        </div>
      </div>
    </section>
  );
}
