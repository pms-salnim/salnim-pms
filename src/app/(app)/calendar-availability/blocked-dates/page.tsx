
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Icons } from "@/components/icons";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import type { RoomType } from '@/types/roomType';
import { format, parseISO } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import type { Room } from '@/types/room';

export default function BlockedDatesPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/calendar-availability/blocked-dates/content');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<AvailabilitySetting[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      setBlockedDates([]);
      setRoomTypes([]);
      setRooms([]);
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    const roomTypesQuery = query(collection(db, "roomTypes"), where("propertyId", "==", propertyId));
    unsubscribers.push(onSnapshot(roomTypesQuery, (snapshot) => {
      setRoomTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomType)));
    }));
    
    const roomsQuery = query(collection(db, "rooms"), where("propertyId", "==", propertyId));
    unsubscribers.push(onSnapshot(roomsQuery, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    }));

    const blockedDatesQuery = query(
      collection(db, "availability"), 
      where("propertyId", "==", propertyId), 
      where("status", "==", "blocked"),
      orderBy("createdAt", "desc")
    );
    unsubscribers.push(onSnapshot(blockedDatesQuery, (snapshot) => {
      setBlockedDates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AvailabilitySetting)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching blocked dates:", error);
      toast({ title: t('toasts.error_title'), description: t('toasts.error_description'), variant: "destructive" });
      setIsLoading(false);
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [propertyId, t]);

  const getAppliesToName = (setting: AvailabilitySetting) => {
    const roomType = roomTypes.find(rt => rt.id === setting.roomTypeId);
    if (setting.roomId) {
        const room = rooms.find(r => r.id === setting.roomId);
        return room ? `${room.name} (${roomType?.name || 'N/A'})` : t('table.unknown_room');
    }
    return roomType ? `${roomType.name} (${t('table.all_rooms')})` : t('table.unknown_room_type');
  };

  const getNoteDisplay = (notes: any) => {
    if (!notes) return "-";
    if (typeof notes === 'string') {
        return notes;
    }
    if (typeof notes === 'object' && notes.key && notes.params) {
        // Translate the note using the stored key and parameters
        return t(notes.key, {
            ...notes.params,
            date: format(parseISO(notes.params.date), 'PPp'),
        });
    }
    return "-";
  };
  
  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.availability) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4 md:px-8 md:py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.headers.applies_to')}</TableHead>
                  <TableHead>{t('table.headers.start_date')}</TableHead>
                  <TableHead>{t('table.headers.end_date')}</TableHead>
                  <TableHead>{t('table.headers.notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {!isLoading && blockedDates.length > 0 && blockedDates.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="font-medium">{getAppliesToName(block)}</TableCell>
                    <TableCell>{format(parseISO(block.startDate), 'PPP')}</TableCell>
                    <TableCell>{block.endDate === '9999-12-31' ? t('table.open_ended') : format(parseISO(block.endDate), 'PPP')}</TableCell>
                    <TableCell className="max-w-sm truncate" title={getNoteDisplay(block.notes)}>
                      {getNoteDisplay(block.notes)}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && blockedDates.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">{t('table.empty_state')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
