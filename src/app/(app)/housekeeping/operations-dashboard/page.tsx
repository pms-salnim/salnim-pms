"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, Timestamp, getDocs, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Home,
  Zap,
  RefreshCw,
  Filter,
  LogIn,
  LogOut,
  User,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Room, CleaningStatus, OccupancyStatus } from '@/types/room';
import type { RoomType } from '@/types/roomType';
import type { Reservation } from '@/types/reservation';
import type { MaintenanceRequest } from '@/types/maintenance';
import type { Property } from '@/types/property';

type RoomWithReservation = Room & {
  reservation?: Reservation;
  maintenance?: MaintenanceRequest[];
  arrivalToday?: boolean;
  checkoutToday?: boolean;
  stayover?: boolean;
};

export default function OperationsDashboardPage() {
  const { user, isLoadingAuth } = useAuth();

  // State
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<RoomWithReservation[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [selectedCleaningStatus, setSelectedCleaningStatus] = useState<string>('all');

  // Modal
  const [selectedRoom, setSelectedRoom] = useState<RoomWithReservation | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newCleaningStatus, setNewCleaningStatus] = useState<CleaningStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const canManage = user?.permissions?.housekeeping;

  // Get property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Fetch property settings
  useEffect(() => {
    if (!propertyId) return;

    const propDocRef = doc(db, 'properties', propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      setPropertySettings(docSnap.exists() ? (docSnap.data() as Property) : null);
    });

    return () => unsubProp();
  }, [propertyId]);

  // Fetch rooms with real-time updates
  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const roomsQuery = query(
      collection(db, 'rooms'),
      where('propertyId', '==', propertyId)
    );

    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      setRooms(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RoomWithReservation)));
      setIsLoading(false);
    });

    return () => unsubRooms();
  }, [propertyId]);

  // Fetch room types
  useEffect(() => {
    if (!propertyId) return;

    const roomTypesQuery = query(collection(db, 'roomTypes'), where('propertyId', '==', propertyId));
    const unsubRoomTypes = onSnapshot(roomTypesQuery, (snapshot) => {
      setRoomTypes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RoomType)));
    });

    return () => unsubRoomTypes();
  }, [propertyId]);

  // Fetch reservations
  useEffect(() => {
    if (!propertyId) return;

    const reservationsQuery = query(
      collection(db, 'reservations'),
      where('propertyId', '==', propertyId),
      where('status', 'in', ['Confirmed', 'Checked-in', 'Pending'])
    );

    const unsubReservations = onSnapshot(reservationsQuery, (snapshot) => {
      setReservations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)));
    });

    return () => unsubReservations();
  }, [propertyId]);

  // Fetch maintenance requests
  useEffect(() => {
    if (!propertyId) return;

    const maintenanceQuery = query(
      collection(db, 'maintenanceRequests'),
      where('propertyId', '==', propertyId),
      where('status', 'in', ['Pending', 'In Progress'])
    );

    const unsubMaintenance = onSnapshot(maintenanceQuery, (snapshot) => {
      setMaintenanceRequests(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MaintenanceRequest)));
    });

    return () => unsubMaintenance();
  }, [propertyId]);

  // Fetch completed tasks count
  useEffect(() => {
    if (!propertyId) return;

    const completedTasksQuery = query(
      collection(db, 'housekeepingTasks'),
      where('propertyId', '==', propertyId),
      where('status', '==', 'completed')
    );

    const unsubCompleted = onSnapshot(completedTasksQuery, (snapshot) => {
      setCompletedTasksCount(snapshot.docs.length);
    });

    return () => unsubCompleted();
  }, [propertyId]);

  // Enrich rooms with reservation and maintenance data
  const enrichedRooms = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rooms.map((room) => {
      const reservation = reservations.find((r) => r.roomId === room.id && r.status !== 'Canceled');
      const maintenance = maintenanceRequests.filter((m) => m.roomId === room.id);

      const arrivalToday =
        reservation &&
        new Date(reservation.startDate).toDateString() === today.toDateString() &&
        reservation.status !== 'Checked-in';

      const checkoutToday =
        reservation &&
        new Date(reservation.endDate).toDateString() === today.toDateString() &&
        reservation.status === 'Checked-in';

      const stayover = reservation && reservation.status === 'Checked-in' && !checkoutToday;

      return {
        ...room,
        reservation,
        maintenance,
        arrivalToday,
        checkoutToday,
        stayover,
      };
    });
  }, [rooms, reservations, maintenanceRequests]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return enrichedRooms.filter((room) => {
      // Search
      if (searchQuery && !room.name.includes(searchQuery)) return false;

      // Floor filter
      if (selectedFloor !== 'all' && room.floor !== parseInt(selectedFloor)) return false;

      // Room type filter
      if (selectedRoomType !== 'all' && room.roomTypeId !== selectedRoomType) return false;

      // Cleaning status filter
      if (selectedCleaningStatus !== 'all' && room.cleaningStatus !== selectedCleaningStatus) return false;

      return true;
    });
  }, [enrichedRooms, searchQuery, selectedFloor, selectedRoomType, selectedCleaningStatus]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalRooms = enrichedRooms.length;
    const cleanRooms = enrichedRooms.filter((r) => r.cleaningStatus === 'clean').length;
    const dirtyRooms = enrichedRooms.filter((r) => r.cleaningStatus === 'dirty').length;
    const inProgressRooms = enrichedRooms.filter((r) => r.cleaningStatus === 'in_progress').length;
    const outOfOrderRooms = enrichedRooms.filter((r) => r.cleaningStatus === 'out_of_order').length;
    const occupiedRooms = enrichedRooms.filter((r) => r.occupancyStatus === 'occupied').length;
    const emptyRooms = enrichedRooms.filter((r) => r.occupancyStatus === 'empty').length;
    const pendingIssues = maintenanceRequests.filter((m) => m.status === 'Pending').length;
    const inProgressIssues = maintenanceRequests.filter((m) => m.status === 'In Progress').length;
    const arrivalsToday = enrichedRooms.filter((r) => r.arrivalToday).length;
    const checkoutsToday = enrichedRooms.filter((r) => r.checkoutToday).length;
    const stayoversToday = enrichedRooms.filter((r) => r.stayover).length;

    return {
      // Cleaning Status
      roomsCleaned: cleanRooms,
      dirtyRooms,
      inProgressRooms,
      outOfOrderRooms,
      completedTasksCount,
      totalRooms,
      
      // Occupancy
      occupancy: totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0.0',
      occupiedRooms,
      emptyRooms,
      
      // Maintenance
      pendingIssues,
      inProgressIssues,
      totalIssues: pendingIssues + inProgressIssues,
      
      // Daily Activity
      arrivalsToday,
      checkoutsToday,
      stayoversToday,
    };
  }, [enrichedRooms, maintenanceRequests, completedTasksCount]);

  const handleStatusChange = async () => {
    if (!selectedRoom || !newCleaningStatus) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'rooms', selectedRoom.id), {
        cleaningStatus: newCleaningStatus,
        updatedAt: Timestamp.now(),
      });
      toast({ title: 'Success', description: `Room ${selectedRoom.name} cleaning status updated to ${newCleaningStatus}` });
      setIsStatusModalOpen(false);
      setSelectedRoom(null);
      setNewCleaningStatus(null);
    } catch (error) {
      console.error('Error updating room status:', error);
      toast({ title: 'Error', description: 'Failed to update cleaning status', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getRoomCardColor = (room: RoomWithReservation) => {
    // Priority: Maintenance issues > Arrival > Checkout > Stayover > Base status
    if (room.maintenance && room.maintenance.length > 0) return 'bg-red-50 border-red-200';
    if (room.arrivalToday) return 'bg-blue-50 border-blue-200';
    if (room.checkoutToday) return 'bg-amber-50 border-amber-200';
    if (room.stayover) return 'bg-emerald-50 border-emerald-200';

    // Base cleaning status colors
    switch (room.cleaningStatus) {
      case 'clean':
        return 'bg-green-50 border-green-200';
      case 'dirty':
        return 'bg-yellow-50 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      case 'out_of_order':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getCleaningStatusBadge = (cleaningStatus: CleaningStatus, room: RoomWithReservation) => {
    if (room.maintenance && room.maintenance.length > 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle size={12} />
          Maintenance
        </Badge>
      );
    }
    if (room.arrivalToday) {
      return (
        <Badge className="gap-1 bg-blue-600">
          <LogIn size={12} />
          Arrival
        </Badge>
      );
    }
    if (room.checkoutToday) {
      return (
        <Badge className="gap-1 bg-amber-600">
          <LogOut size={12} />
          Checkout
        </Badge>
      );
    }
    if (room.stayover) {
      return (
        <Badge className="gap-1 bg-emerald-600">
          <User size={12} />
          Stayover
        </Badge>
      );
    }

    switch (cleaningStatus) {
      case 'clean':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-600 text-white">
            <CheckCircle2 size={12} />
            Clean
          </Badge>
        );
      case 'dirty':
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-600 text-white">
            <AlertCircle size={12} />
            Dirty
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="secondary" className="gap-1 bg-blue-600 text-white">
            <Zap size={12} />
            In Progress
          </Badge>
        );
      case 'out_of_order':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle size={12} />
            OOO
          </Badge>
        );
      default:
        return <Badge variant="secondary">{cleaningStatus}</Badge>;
    }
  };

  const getOccupancyBadge = (occupancyStatus: OccupancyStatus) => {
    switch (occupancyStatus) {
      case 'occupied':
        return (
          <Badge className="gap-1 bg-slate-600 text-xs">
            <User size={10} />
            Occupied
          </Badge>
        );
      case 'empty':
        return (
          <Badge variant="outline" className="gap-1 text-xs">
            <Home size={10} />
            Empty
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-xs">{occupancyStatus}</Badge>;
    }
  };

  const getFloors = useMemo(() => {
    const floors = new Set(enrichedRooms.map((r) => r.floor).filter((floor) => floor !== undefined));
    return Array.from(floors).sort((a, b) => (a || 0) - (b || 0)) as number[];
  }, [enrichedRooms]);

  const cleaningStatusOptions: CleaningStatus[] = ['clean', 'dirty', 'in_progress', 'out_of_order'];

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>You do not have permission to access housekeeping operations.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Operations Dashboard</h1>
          <p className="text-slate-600 mt-2">Real-time room status and housekeeping management</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2">
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {/* Rooms Cleaned */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Clean</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-700">
                {kpis.roomsCleaned}/{kpis.totalRooms}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Dirty Rooms */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-yellow-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dirty</p>
              <h3 className="text-2xl font-bold mt-1 text-yellow-700">
                {kpis.dirtyRooms}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-yellow-50">
              <AlertCircle size={18} className="text-yellow-600" />
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-bold mt-1 text-blue-700">
                {kpis.inProgressRooms}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <Zap size={18} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Out of Order */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Out of Order</p>
              <h3 className="text-2xl font-bold mt-1 text-red-700">
                {kpis.outOfOrderRooms}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-red-50">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</p>
              <h3 className="text-2xl font-bold mt-1 text-green-700">
                {kpis.completedTasksCount}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Maintenance Issues */}
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-rose-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Issues</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-700">{kpis.totalIssues}</h3>
              <p className="text-[10px] font-medium text-rose-600 mt-1">{kpis.pendingIssues} pending</p>
            </div>
            <div className="p-2 rounded-lg bg-rose-50">
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-4 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search room name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Floor Filter */}
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Floors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {getFloors.map((floor) => (
                <SelectItem key={floor} value={floor.toString()}>
                  Floor {floor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Room Type Filter */}
          <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Room Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Room Types</SelectItem>
              {roomTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Cleaning Status Filter */}
          <Select value={selectedCleaningStatus} onValueChange={setSelectedCleaningStatus}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {cleaningStatusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Room Status Grid by Room Type */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-900">Room Status Board</h2>
        {filteredRooms.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 text-center py-12">
            <Home className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No rooms found</h3>
            <p className="text-slate-600">Adjust your filters to find rooms</p>
          </div>
        ) : (
          <>
            {roomTypes.map((type) => {
              const typeRooms = filteredRooms.filter((r) => r.roomTypeId === type.id);
              if (typeRooms.length === 0) return null;

              const typeStats = {
                total: typeRooms.length,
                clean: typeRooms.filter((r) => r.cleaningStatus === 'clean').length,
                dirty: typeRooms.filter((r) => r.cleaningStatus === 'dirty').length,
                inProgress: typeRooms.filter((r) => r.cleaningStatus === 'in_progress').length,
                occupied: typeRooms.filter((r) => r.occupancyStatus === 'occupied').length,
                issues: typeRooms.filter((r) => r.maintenance && r.maintenance.length > 0).length,
              };

              return (
                <div key={type.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Section Header */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                          <Home size={18} className="text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{type.name}</h3>
                          <p className="text-xs text-slate-600">{type.description}</p>
                        </div>
                      </div>
                      
                      {/* Quick Stats */}
                      <div className="flex gap-4 text-center">
                        <div className="min-w-max">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Total</p>
                          <p className="text-lg font-bold text-slate-900">{typeStats.total}</p>
                        </div>
                        <div className="min-w-max">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Clean</p>
                          <p className="text-lg font-bold text-emerald-600">{typeStats.clean}</p>
                        </div>
                        <div className="min-w-max">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Occupied</p>
                          <p className="text-lg font-bold text-blue-600">{typeStats.occupied}</p>
                        </div>
                        {typeStats.issues > 0 && (
                          <div className="min-w-max">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Issues</p>
                            <p className="text-lg font-bold text-red-600">{typeStats.issues}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Room Cards */}
                  <div className="p-5">
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {typeRooms.map((room) => (
                        <div
                          key={room.id}
                          onClick={() => {
                            setSelectedRoom(room);
                            setNewCleaningStatus(room.cleaningStatus);
                            setIsStatusModalOpen(true);
                          }}
                          className={cn(
                            'p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col',
                            getRoomCardColor(room)
                          )}
                        >
                          <div className="space-y-2">
                            {/* Room Name - Large and Prominent */}
                            <div className="text-center">
                              <h4 className="text-2xl font-black text-slate-900 leading-tight">{room.name}</h4>
                            </div>

                            {/* Primary: Cleaning Status Badge */}
                            <div className="flex justify-center">{getCleaningStatusBadge(room.cleaningStatus, room)}</div>

                            {/* Secondary: Occupancy Status Badge */}
                            <div className="flex justify-center">{getOccupancyBadge(room.occupancyStatus)}</div>

                            {/* Guest Name */}
                            {room.reservation && (
                              <div className="text-center">
                                <span className="text-xs font-semibold px-2 py-1 bg-white/70 rounded-full text-slate-700 line-clamp-1">
                                  {room.reservation.guestName?.split(' ')[0]}
                                </span>
                              </div>
                            )}

                            {/* Issues */}
                            {room.maintenance && room.maintenance.length > 0 && (
                              <div className="text-xs text-red-600 font-bold bg-red-100/60 p-1.5 rounded text-center">
                                ⚠️ {room.maintenance.length} issue{room.maintenance.length > 1 ? 's' : ''}
                              </div>
                            )}

                            {/* Dates */}
                            {room.reservation && (
                              <div className="text-[10px] text-slate-600 truncate text-center" title={`${room.reservation.startDate} → ${room.reservation.endDate}`}>
                                {new Date(room.reservation.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(room.reservation.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Cleaning Status Update Modal */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Cleaning Status</DialogTitle>
            <DialogDescription>
              Change cleaning status for {selectedRoom?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedRoom && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Guest Name</p>
                  <p className="text-slate-900">{selectedRoom.reservation?.guestName || 'No guest'}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Occupancy Status</p>
                  <Badge className={selectedRoom.occupancyStatus === 'occupied' ? 'bg-blue-600' : ''}>
                    {selectedRoom.occupancyStatus === 'occupied' ? 'Occupied' : 'Empty'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Current Cleaning Status</p>
                  <Badge>{selectedRoom.cleaningStatus}</Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">New Cleaning Status</p>
                  <Select value={newCleaningStatus || ''} onValueChange={(value) => setNewCleaningStatus(value as CleaningStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {cleaningStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRoom.maintenance && selectedRoom.maintenance.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-semibold text-red-900">Open Maintenance Issues:</p>
                    <ul className="text-sm text-red-800 space-y-1">
                      {selectedRoom.maintenance.map((m) => (
                        <li key={m.id}>• {m.issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStatusChange}
                    disabled={isUpdating || !newCleaningStatus || newCleaningStatus === selectedRoom.cleaningStatus}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isUpdating ? 'Updating...' : 'Update Status'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
