
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Room, RoomStatus } from '@/types/room';
import { Pie, PieChart, ResponsiveContainer, Cell, Legend, Tooltip } from 'recharts';

interface RoomsOverviewProps {
  propertyId: string;
}

export default function RoomsOverview({ propertyId }: RoomsOverviewProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypesCount, setRoomTypesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    // Fetch Rooms for stats and chart
    const roomsColRef = collection(db, "rooms");
    const roomsQuery = query(roomsColRef, where("propertyId", "==", propertyId));
    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const currentRooms = snapshot.docs.map(doc => doc.data() as Room);
      setRooms(currentRooms);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching rooms for overview:", error);
      setIsLoading(false);
    });

    // Fetch Room Types count
    const roomTypesColRef = collection(db, "roomTypes");
    const roomTypesQuery = query(roomTypesColRef, where("propertyId", "==", propertyId));
    const unsubRoomTypes = onSnapshot(roomTypesQuery, (snapshot) => {
      setRoomTypesCount(snapshot.size);
    }, (error) => {
      console.error("Error fetching room types count:", error);
    });
    
    return () => {
      unsubRooms();
      unsubRoomTypes();
    };
  }, [propertyId]);

  const summaryStats = useMemo(() => {
    return rooms.reduce((acc, room) => {
        acc.totalRooms++;
        if (room.status === 'Occupied') acc.occupiedRooms++;
        else if (room.status === 'Available') acc.availableRooms++;
        else if (room.status === 'Maintenance' || room.status === 'Out of Order') acc.maintenanceRooms++;
        return acc;
    }, { totalRooms: 0, occupiedRooms: 0, availableRooms: 0, maintenanceRooms: 0 });
  }, [rooms]);
  
  const pieChartData = useMemo(() => {
    if (rooms.length === 0) return [];
    const statusCounts = rooms.reduce((acc, room) => {
        acc[room.status] = (acc[room.status] || 0) + 1;
        return acc;
    }, {} as Record<RoomStatus, number>);

    return Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
    }));
  }, [rooms]);

  const COLORS: Record<string, string> = {
      Available: 'hsl(var(--chart-2))',
      Occupied: 'hsl(var(--chart-1))',
      Maintenance: 'hsl(var(--chart-4))',
      Cleaning: 'hsl(var(--chart-3))',
      Dirty: 'hsl(var(--chart-5))',
      'Out of Order': 'hsl(var(--muted-foreground))',
  };
  
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    if (percent < 0.05) return null; // Don't render label for small slices
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };


  const summaryCards = [
    { title: "Total Rooms", value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.totalRooms.toString(), icon: Icons.BedDouble, dataAiHint: "bed hotel" },
    { title: "Occupied Rooms", value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.occupiedRooms.toString(), icon: Icons.LogIn, dataAiHint: "person door" },
    { title: "Available Rooms", value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.availableRooms.toString(), icon: Icons.CheckCircle2, dataAiHint: "check mark" },
    { title: "Maintenance / OoO", value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.maintenanceRooms.toString(), icon: Icons.Settings, dataAiHint: "tools wrench" },
    { title: "Room Types", value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : roomTypesCount.toString(), icon: Icons.Home, dataAiHint: "house key" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card key={card.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" data-ai-hint={card.dataAiHint}/>}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Occupancy Distribution</CardTitle>
          <CardDescription>Visual representation of room statuses.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
                <Icons.Spinner className="h-8 w-8 animate-spin" />
            </div>
          ) : pieChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                    contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)"
                    }}
                    formatter={(value, name) => [`${value} room(s)`, name]}
                />
                <Legend iconType="circle" />
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={120}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#888888'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                <p>No room data to display.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
