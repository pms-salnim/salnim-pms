
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from "@/components/icons";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Room } from '@/types/room';
import type { Reservation } from '@/components/calendar/types';
import { PieChart, Pie, ResponsiveContainer, Cell, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, startOfDay, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, addDays, isEqual, addDays as addDaysBase } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const BRAND_COLOR = '#003166';

export default function RoomsOverviewPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation('pages/rooms/overview/content');
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomTypesCount, setRoomTypesCount] = useState(0);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: startOfDay(new Date()),
  });

  useEffect(() => {
    if(user?.propertyId) {
        setPropertyId(user.propertyId);
    }
  }, [user]);


  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    let activeListeners = 3;
    const doneLoading = () => {
        activeListeners--;
        if (activeListeners === 0) {
            setIsLoading(false);
        }
    }

    // Fetch Rooms - data from /rooms/list page
    const roomsQuery = query(collection(db, "rooms"), where("propertyId", "==", propertyId));
    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Map 'name' to 'roomNumber' if roomNumber is missing
          roomNumber: data.roomNumber || data.name || 'Unknown',
          // Ensure cleaning status is properly set
          cleaningStatus: data.cleaningStatus || 'clean',
          // Ensure status is properly set
          status: data.status || 'Available',
          // Room type info
          roomTypeName: data.roomTypeName || 'Standard',
          maxGuests: data.maxGuests || 1,
        } as Room;
      });
      setRooms(roomsData);
      doneLoading();
    }, (error) => { 
      console.error("Error fetching rooms:", error); 
      doneLoading(); 
    });

    // Fetch Reservations for occupancy calculations
    const reservationsQuery = query(
      collection(db, "reservations"), 
      where("propertyId", "==", propertyId)
    );
    const unsubReservations = onSnapshot(reservationsQuery, (snapshot) => {
        const reservationsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                startDate: (data.startDate as Timestamp).toDate(),
                endDate: (data.endDate as Timestamp).toDate(),
                status: data.status || 'Confirmed',
                // Ensure roomId is available
                roomId: data.rooms?.[0]?.roomId || data.roomId || '',
            } as Reservation;
        }).filter(res => res.roomId); // Only include reservations with valid room IDs
        setReservations(reservationsData);
        doneLoading();
    }, (error) => { 
      console.error("Error fetching reservations:", error); 
      doneLoading(); 
    });

    // Fetch Room Types - data from /rooms/types page
    const roomTypesQuery = query(collection(db, "roomTypes"), where("propertyId", "==", propertyId));
    const unsubRoomTypes = onSnapshot(roomTypesQuery, (snapshot) => {
      const roomTypesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRoomTypes(roomTypesData);
      setRoomTypesCount(snapshot.size);
      doneLoading();
    }, (error) => { 
      console.error("Error fetching room types:", error); 
      doneLoading(); 
    });
    
    return () => {
      unsubRooms();
      unsubReservations();
      unsubRoomTypes();
    };
  }, [propertyId]);

  const summaryStats = useMemo(() => {
    const totalRooms = rooms.length;
    if (!selectedRange?.from || totalRooms === 0) {
      return { totalRooms, occupied: 0, available: totalRooms, isRange: false, occupancyRate: 0 };
    }

    const rangeStart = startOfDay(selectedRange.from);
    const rangeEnd = selectedRange.to ? startOfDay(selectedRange.to) : rangeStart;

    if (rangeEnd < rangeStart) {
      return { totalRooms, occupied: 0, available: totalRooms, isRange: false, occupancyRate: 0 };
    }
    
    const isRange = !isEqual(rangeStart, rangeEnd);
    
    const daysToIterate = eachDayOfInterval({ start: rangeStart, end: isRange ? addDays(rangeEnd, -1) : rangeEnd });
    
    const divisor = isRange ? daysToIterate.length : 1;

    if (divisor === 0 && isRange) {
        return { totalRooms, occupied: 0, available: totalRooms, isRange, occupancyRate: 0 };
    }

    let totalOccupiedRoomNights = 0;

    daysToIterate.forEach(day => {
        const occupiedOnThisDay = new Set<string>();
        reservations.forEach(res => {
            // Only count confirmed or checked-in reservations
            if (res.status && (res.status === 'Confirmed' || res.status === 'Checked-in' || res.status === 'Completed')) {
                const resStart = startOfDay(res.startDate);
                const resEnd = startOfDay(res.endDate);
                // Check if day falls within reservation period
                if (startOfDay(day) >= resStart && startOfDay(day) < resEnd) {
                    occupiedOnThisDay.add(res.roomId);
                }
            }
        });
        totalOccupiedRoomNights += occupiedOnThisDay.size;
    });
    
    const occupiedValue = isRange ? totalOccupiedRoomNights / divisor : totalOccupiedRoomNights;
    const occupancyRate = totalRooms > 0 ? (occupiedValue / totalRooms) * 100 : 0;
    
    return {
      totalRooms,
      occupied: occupiedValue,
      available: Math.max(0, totalRooms - occupiedValue),
      isRange,
      occupancyRate
    };
  }, [rooms, reservations, selectedRange]);
  
  const pieChartData = useMemo(() => {
    // This data is no longer used, keeping for backward compatibility
    if (summaryStats.totalRooms === 0) return [];
    const dataMap: Record<string, number> = {
        'Available': summaryStats.available,
        'Occupied': summaryStats.occupied,
    };
    return Object.entries(dataMap)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
  }, [summaryStats]);

  // Room Status Breakdown - uses cleaningStatus field
  const roomStatusData = useMemo(() => {
    const statusMap: Record<string, number> = {
      'Clean': 0,
      'Dirty': 0,
      'In Progress': 0,
      'Out of Order': 0,
    };

    rooms.forEach(room => {
      // Map cleaningStatus values to display names
      const status = room.cleaningStatus || 'clean';
      const statusMap_key = 
        status === 'clean' ? 'Clean' :
        status === 'dirty' ? 'Dirty' :
        status === 'in_progress' ? 'In Progress' :
        status === 'out_of_order' ? 'Out of Order' : 'Clean';
      
      if (statusMap.hasOwnProperty(statusMap_key)) {
        statusMap[statusMap_key]++;
      }
    });

    return Object.entries(statusMap)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [rooms]);

  // Room Type Distribution
  const roomTypeDistribution = useMemo(() => {
    // Count total and occupied rooms for each room type
    const roomCountByType: Record<string, { total: number; occupied: number }> = {};
    
    rooms.forEach(room => {
      const typeId = room.roomTypeId || room.roomType;
      if (typeId) {
        if (!roomCountByType[typeId]) {
          roomCountByType[typeId] = { total: 0, occupied: 0 };
        }
        roomCountByType[typeId].total++;
        
        // Check if room is occupied (has a checked-in reservation)
        const today = startOfDay(new Date());
        const isOccupied = reservations.some(res => {
          // Only count Checked-in reservations (matching summaryStats logic)
          if (res.status !== 'Checked-in') return false;
          
          const resStart = startOfDay(res.startDate);
          const resEnd = startOfDay(res.endDate);
          
          // Check if today falls within reservation period
          return res.roomId === room.id &&
                 today >= resStart &&
                 today < resEnd;
        });
        
        if (isOccupied) {
          roomCountByType[typeId].occupied++;
        }
      }
    });

    // Map room types with their counts
    return roomTypes
      .map(type => ({
        name: type.name || 'Unknown',
        total: roomCountByType[type.id]?.total || 0,
        occupied: roomCountByType[type.id]?.occupied || 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [rooms, roomTypes, reservations]);

  // Daily Occupancy Trend
  const occupancyTrendData = useMemo(() => {
    if (!selectedRange?.from) return [];

    const rangeStart = startOfDay(selectedRange.from);
    const rangeEnd = selectedRange.to ? startOfDay(selectedRange.to) : rangeStart;

    if (rangeEnd < rangeStart) return [];

    const daysToIterate = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const totalRooms = rooms.length || 1;

    return daysToIterate.map(day => {
      const occupiedOnThisDay = new Set<string>();
      reservations.forEach(res => {
        if (res.status !== 'Canceled' && res.status !== 'No-Show') {
          const resStart = startOfDay(res.startDate);
          const resEnd = startOfDay(res.endDate);
          if (startOfDay(day) >= resStart && startOfDay(day) < resEnd) {
            occupiedOnThisDay.add(res.roomId);
          }
        }
      });

      const occupancyRate = (occupiedOnThisDay.size / totalRooms) * 100;
      return {
        date: format(day, 'MMM dd'),
        occupancy: parseFloat(occupancyRate.toFixed(1)),
      };
    });
  }, [rooms, reservations, selectedRange]);

  const BRAND_COLOR = '#003166';
  const COLORS: Record<string, string> = {
    Available: '#10b981',
    Occupied: '#3b82f6',
  };
  
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
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
  
  const { isRange } = summaryStats;
  
  const summaryCards = [
    { title: t('cards.total_rooms'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.totalRooms.toString(), icon: Icons.BedDouble, dataAiHint: "bed hotel", subtext: "Total Inventory" },
    { title: isRange ? t('cards.occupied_avg') : t('cards.occupied_single'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.occupied.toFixed(isRange ? 1 : 0), icon: Icons.LogIn, dataAiHint: "person door", subtext: "Currently Occupied" },
    { title: isRange ? t('cards.available_avg') : t('cards.available_single'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : summaryStats.available.toFixed(isRange ? 1 : 0), icon: Icons.CheckCircle2, dataAiHint: "check mark", subtext: "Ready to Book" },
    { title: t('cards.room_types'), value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : roomTypesCount.toString(), icon: Icons.Home, dataAiHint: "house key", subtext: "Types Available" },
    { title: "Occupancy Rate", value: isLoading ? <Icons.Spinner className="animate-spin h-5 w-5"/> : `${summaryStats.occupancyRate.toFixed(1)}%`, icon: Icons.TrendingUp, dataAiHint: "trending chart", subtext: "Current Rate" },
  ];
  
  const setPresetDateRange = (preset: "today" | "this_week" | "this_month") => {
    const today = new Date();
    if (preset === "today") {
      setSelectedRange({ from: today, to: today });
    } else if (preset === "this_week") {
      setSelectedRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
    } else if (preset === "this_month") {
      setSelectedRange({ from: startOfMonth(today), to: endOfMonth(today) });
    }
  };

  const getPageTitle = () => {
    // Legacy function - no longer used in new layout
    if (!selectedRange?.from) return t('title');
    const fromFormatted = format(selectedRange.from, "PPP");
    if (!selectedRange.to || format(selectedRange.from, 'yyyy-MM-dd') === format(selectedRange.to, 'yyyy-MM-dd')) {
        return t('chart.title_single', { date: fromFormatted });
    }
    const toFormatted = format(selectedRange.to, "PPP");
    return t('chart.title_range', { from: fromFormatted, to: toFormatted });
  };

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.rooms) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>{t('access_denied.description')}</AlertDescription>
      </Alert>
    );
  }

  // Get rooms with out of order or dirty status for critical exceptions
  const criticalExceptions = useMemo(() => {
    return rooms
      .filter(room => 
        room.cleaningStatus === 'out_of_order' || 
        room.cleaningStatus === 'dirty' ||
        room.status === 'Out of Order'
      )
      .slice(0, 5); // Show top 5
  }, [rooms]);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans pb-4">
      <main className="p-4 w-full mx-auto space-y-6">
        {/* Metric Cards - Top Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {summaryCards.map((card, index) => {
            const IconComponent = card.icon;
            const borderColors = ['border-[#003166]', 'border-blue-500', 'border-emerald-500', 'border-indigo-500', 'border-amber-500'];
            const iconBgColors = ['bg-slate-100', 'bg-blue-100', 'bg-emerald-100', 'bg-indigo-100', 'bg-amber-100'];
            const iconColors = ['text-slate-600', 'text-blue-600', 'text-emerald-600', 'text-indigo-600', 'text-amber-600'];
            
            return (
              <div
                key={card.title}
                className={`bg-white rounded-xl p-3 shadow-sm border-l-4 ${borderColors[index]} transition-transform hover:-translate-y-1`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{card.title}</p>
                    <h3 className="text-2xl font-bold mt-1.5 text-slate-800">{card.value}</h3>
                  </div>
                  <div className={`p-1.5 rounded-lg ${iconBgColors[index]}`}>
                    <IconComponent size={16} className={iconColors[index]} data-ai-hint={card.dataAiHint} />
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`text-[10px] font-medium ${iconColors[index]}`}>{card.subtext || 'Metric'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                className="px-4 py-2 text-white text-sm font-medium rounded-lg"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                <Icons.CalendarDays className="mr-2 h-4 w-4" />
                Select Date Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
              <div className="flex flex-col space-y-1 border-b sm:border-b-0 sm:border-r p-2">
                <Button variant="ghost" size="sm" className="justify-start hover:bg-blue-50 text-xs" onClick={() => setPresetDateRange("today")}>
                  Today
                </Button>
                <Button variant="ghost" size="sm" className="justify-start hover:bg-blue-50 text-xs" onClick={() => setPresetDateRange("this_week")}>
                  Next 7 Days
                </Button>
                <Button variant="ghost" size="sm" className="justify-start hover:bg-blue-50 text-xs" onClick={() => setPresetDateRange("this_month")}>
                  This Month
                </Button>
              </div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={selectedRange?.from}
                selected={selectedRange}
                onSelect={setSelectedRange}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setPresetDateRange("today")}>
            Today
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setPresetDateRange("this_week")}>
            Next 7 Days
          </Button>

          {/* Last Updated Info */}
          <div className="ml-auto text-[10px] text-slate-400 whitespace-nowrap">
            INVENTORY STATUS AS OF<br/>
            {format(new Date(), 'MMM dd, yyyy - hh:mm a')}
          </div>
        </div>

        {/* Main Grid Layout */}
        {/* Top Row - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Room Status Breakdown - Donut Chart */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND_COLOR }}></div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Room Status Breakdown</h2>
            </div>

            {isLoading ? (
              <div className="flex h-[250px] items-center justify-center">
                <Icons.Spinner className="h-8 w-8 animate-spin" />
              </div>
            ) : roomStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value) => `${value} room(s)`}
                  />
                  <Legend 
                    iconType="circle" 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value, entry: any) => <span style={{ fontSize: '12px', color: '#64748b' }}>{`${value} (${entry.payload.value})`}</span>}
                  />
                  <Pie
                    data={roomStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="white"
                    strokeWidth={2}
                  >
                    {roomStatusData.map((entry, index) => {
                      const statusColors: Record<string, string> = {
                        'Clean': '#10b981',
                        'Dirty': '#f59e0b',
                        'In Progress': '#3b82f6',
                        'Out of Order': '#ef4444',
                      };
                      return <Cell key={`cell-${entry.name}`} fill={statusColors[entry.name] || '#888888'} />;
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-slate-400 text-sm">
                <p>No room status data</p>
              </div>
            )}
          </div>

          {/* Occupancy Status - Pie Chart */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND_COLOR }}></div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Occupancy Status</h2>
            </div>

            {isLoading ? (
              <div className="flex h-[250px] items-center justify-center">
                <Icons.Spinner className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value) => `${value} room(s)`}
                  />
                  <Legend 
                    iconType="circle" 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value, entry: any) => <span style={{ fontSize: '12px', color: '#64748b' }}>{`${value} (${entry.payload.value.toFixed(0)})`}</span>}
                  />
                  <Pie
                    data={[
                      { name: 'Occupied', value: summaryStats.occupied },
                      { name: 'Available', value: summaryStats.available }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="white"
                    strokeWidth={2}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom Row - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Room Type Distribution - Custom Bar List */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND_COLOR }}></div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Room Type Distribution</h2>
            </div>

            {isLoading ? (
              <div className="flex h-[200px] items-center justify-center">
                <Icons.Spinner className="h-8 w-8 animate-spin" />
              </div>
            ) : roomTypeDistribution.length > 0 ? (
              <div className="space-y-5">
                {roomTypeDistribution.map((item, index) => {
                  const occupancyPercentage = item.total > 0 ? (item.occupied / item.total) * 100 : 0;
                  
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                        <span className="text-sm font-semibold text-slate-400">{item.occupied}/{item.total} Rooms</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${occupancyPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-slate-400 text-sm">
                <p>No room type data</p>
              </div>
            )}
          </div>

          {/* Critical Exceptions */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND_COLOR }}></div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Critical Exceptions</h2>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Icons.Spinner className="h-6 w-6 animate-spin" />
              </div>
            ) : criticalExceptions.length > 0 ? (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {criticalExceptions.map((room) => {
                  const statusText = room.cleaningStatus === 'out_of_order' ? 'OUT OF ORDER' : 'DIRTY';
                  const statusColor = room.cleaningStatus === 'out_of_order' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-yellow-50 border-l-4 border-yellow-500';
                  const textColor = room.cleaningStatus === 'out_of_order' ? 'text-red-700' : 'text-yellow-700';

                  return (
                    <div key={room.id} className={`p-3 rounded-lg ${statusColor}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className={`text-sm font-bold ${textColor}`}>{room.roomNumber}</p>
                        </div>
                        <p className={`text-[10px] font-bold ${textColor}`}>{statusText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
                <p>No critical exceptions</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
