

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RevenueFilters from '@/components/revenue/revenue-filters';
import RevenueTable from '@/components/revenue/revenue-table';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc } from 'firebase/firestore';
import type { Reservation } from '@/components/calendar/types';
import type { Property } from '@/types/property';
import type { RoomType } from '@/types/roomType';
import { subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';

export default function RevenueLogPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/revenue/revenue-log/content');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<any>({
    dateRange: { from: subDays(new Date(), 29), to: new Date() },
    bookingSource: 'all',
    roomType: 'all',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      setPropertySettings(docSnap.exists() ? (docSnap.data() as Property) : null);
    });

    const roomTypesQuery = query(collection(db, "roomTypes"), where("propertyId", "==", propertyId));
    const unsubRoomTypes = onSnapshot(roomTypesQuery, (snapshot) => {
      setRoomTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomType)));
    });

    const reservationsColRef = collection(db, "reservations");
    const q = query(reservationsColRef, where("propertyId", "==", propertyId));
    const unsubscribeReservations = onSnapshot(q, (snapshot) => {
      setReservations(snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        startDate: (docSnap.data().startDate as Timestamp).toDate(),
        endDate: (docSnap.data().endDate as Timestamp).toDate(),
        createdAt: docSnap.data().createdAt ? (docSnap.data().createdAt as Timestamp).toDate() : new Date(),
      } as Reservation)));
      setIsLoading(false);
    });

    return () => {
      unsubProp();
      unsubRoomTypes();
      unsubscribeReservations();
    };
  }, [propertyId]);
  
  const uniqueRoomTypes = useMemo(() => {
    if (!roomTypes) return [];
    return roomTypes.map(rt => rt.name).sort();
  }, [roomTypes]);

  const uniqueBookingSources = useMemo(() => {
    if (!reservations) return [];
    const sources = reservations.map(res => res.source).filter((s): s is 'Direct' | 'Walk-in' | 'OTA' => !!s);
    return [...new Set(sources)].sort();
  }, [reservations]);
  
  const handleApplyFilters = useCallback((newFilters: any) => {
    setCurrentPage(1);
    setActiveFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const revenueDataForTable = useMemo(() => {
    return reservations.filter(res => {
      const isRevenueStatus = res.paymentStatus === 'Paid' && !res.paidWithPoints;
      if (!isRevenueStatus) return false;

      // Date Range Filter (on booking creation date)
      if (activeFilters.dateRange?.from && activeFilters.dateRange?.to) {
        if (!res.createdAt || !isWithinInterval(res.createdAt, { start: startOfDay(activeFilters.dateRange.from), end: endOfDay(activeFilters.dateRange.to) })) {
          return false;
        }
      }

      // Booking Source Filter
      if (activeFilters.bookingSource !== 'all' && res.source !== activeFilters.bookingSource) {
        return false;
      }

      // Room Type Filter
      if (activeFilters.roomType !== 'all') {
        const roomTypeName = roomTypes.find(rt => rt.id === res.roomTypeId)?.name;
        if (roomTypeName !== activeFilters.roomType) {
          return false;
        }
      }
      
      return true;
    });
  }, [reservations, roomTypes, activeFilters]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return revenueDataForTable.slice(startIndex, startIndex + itemsPerPage);
  }, [revenueDataForTable, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(revenueDataForTable.length / itemsPerPage);

  if (isLoadingAuth || (isLoading && !propertyId)) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Loading...</p></div>;
  }
  
  if (!user?.permissions?.reports) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view revenue reports. Please contact an administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
       <RevenueFilters 
        onApplyFilters={handleApplyFilters} 
        roomTypes={uniqueRoomTypes}
        bookingSources={uniqueBookingSources}
      />
      <RevenueTable 
        data={paginatedData}
        currency={propertySettings?.currency || "$"}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        onNextPage={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
        onPrevPage={() => setCurrentPage(p => Math.max(p - 1, 1))}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(value: string) => {
            setItemsPerPage(Number(value));
            setCurrentPage(1);
        }}
      />
    </div>
  );
}

    