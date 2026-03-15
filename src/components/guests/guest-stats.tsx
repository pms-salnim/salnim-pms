
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { useTranslation } from "react-i18next";
import type { Reservation } from '@/components/calendar/types';
import { differenceInDays, format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import type { Guest } from '@/types/guest';
import type { Timestamp } from 'firebase/firestore';
import type { RoomType } from '@/types/roomType';


interface GuestStatsProps {
  guest: Guest;
  reservations: Reservation[];
  roomTypes: RoomType[];
}

const formatDateField = (dateField?: string | Date | Timestamp): string => {
    if (!dateField) return "N/A";
    if (typeof dateField === 'string') {
      try { return format(parseISO(dateField), 'PPP'); } catch { return dateField; }
    }
    if (dateField instanceof Date) {
      return format(dateField, 'PPP');
    }
    // Assume Firestore Timestamp
    if (typeof (dateField as Timestamp).toDate === 'function') {
        return format((dateField as Timestamp).toDate(), 'PPP');
    }
    return 'N/A';
};


export default function GuestStats({ guest, reservations, roomTypes }: GuestStatsProps) {
  const { t } = useTranslation('pages/guests/all/content');
  const { property } = useAuth();
  const currencySymbol = property?.currency || '$';

  const stats = useMemo(() => {
    if (!reservations) { // Add this guard clause
      return {
        totalNights: 0,
        totalSpent: 0,
        mostUsedRoomType: "N/A",
        averageLengthOfStay: "N/A",
        lastStayDate: "N/A",
        averageSpendPerNight: 0,
      };
    }
    
    const validStays = reservations.filter(res => res.status === 'Completed' || res.status === 'Checked-in');
    
    const totalNights = validStays.reduce((acc, res) => acc + differenceInDays(res.endDate, res.startDate), 0);
    const totalSpent = validStays.reduce((acc, res) => acc + (res.totalPrice || 0), 0);
    const totalReservations = validStays.length;

    let favoriteRoomTypeName = "N/A";
    if (validStays.length > 0 && roomTypes.length > 0) {
      const nightsByRoomType: { [key: string]: number } = {};
      
      validStays.forEach(res => {
        const nights = differenceInDays(res.endDate, res.startDate);
        if (res.rooms && res.rooms.length > 0) {
            const roomTypeId = res.rooms[0].roomTypeId;
            nightsByRoomType[roomTypeId] = (nightsByRoomType[roomTypeId] || 0) + nights;
        }
      });

      if (Object.keys(nightsByRoomType).length > 0) {
        const favoriteTypeId = Object.keys(nightsByRoomType).reduce((a, b) => 
          nightsByRoomType[a] > nightsByRoomType[b] ? a : b
        );

        if (favoriteTypeId) {
          favoriteRoomTypeName = roomTypes.find(rt => rt.id === favoriteTypeId)?.name || "Unknown";
        }
      }
    }

    const averageLengthOfStay = totalReservations > 0 ? (totalNights / totalReservations).toFixed(1) + " nights" : "N/A";
    const lastStayDate = guest.lastStayDate ? formatDateField(guest.lastStayDate) : "N/A";
    const averageSpendPerNight = totalNights > 0 ? totalSpent / totalNights : 0;
    
    return {
      totalNights,
      totalSpent,
      mostUsedRoomType: favoriteRoomTypeName,
      averageLengthOfStay,
      lastStayDate,
      averageSpendPerNight,
    };
  }, [guest, reservations, roomTypes]);


  const statItems = [
    { label: t('stats.total_nights'), value: stats.totalNights, icon: Icons.BedDouble },
    { label: t('stats.total_spent'), value: `${currencySymbol}${stats.totalSpent.toFixed(2)}`, icon: Icons.DollarSign },
    { label: t('stats.favorite_room'), value: stats.mostUsedRoomType, icon: Icons.Home },
    { label: t('stats.avg_stay'), value: stats.averageLengthOfStay, icon: Icons.CalendarDays },
    { label: t('stats.avg_spend'), value: `${currencySymbol}${stats.averageSpendPerNight.toFixed(2)}`, icon: Icons.CreditCard },
    { label: t('stats.last_stay'), value: stats.lastStayDate, icon: Icons.LogOut },
  ];


  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stats.title')}</CardTitle>
        <CardDescription>
          {t('stats.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statItems.map(item => {
                const IconComponent = item.icon;
                return (
                    <Card key={item.label} className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                            {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" />}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{item.value}</div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
