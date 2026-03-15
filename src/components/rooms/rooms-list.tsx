
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Grid3X3, List, Settings2 } from "lucide-react";
import { Icons } from "@/components/icons";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, type Timestamp, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { Room, RoomStatus } from '@/types/room';
import { roomStatuses } from '@/types/room';
import type { RoomType } from '@/types/roomType';
import type { Property } from "@/types/property";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import type { Reservation } from "@/components/calendar/types";
import { startOfDay, format, isBetween, isWithinInterval } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RoomsListProps {
  propertyId: string;
}

export default function RoomsList({ propertyId }: RoomsListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const { t } = useTranslation('pages/rooms/list/content');

  // Form state
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");
  const [roomName, setRoomName] = useState(""); 
  const [selectedRoomNames, setSelectedRoomNames] = useState<string[]>([]);
  const [floor, setFloor] = useState("");
  const [amenities, setAmenities] = useState(""); 
  const [notes, setNotes] = useState("");

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRoomType, setFilterRoomType] = useState("all");
  const [filterStatus, setFilterStatus] = useState<'Available' | 'Occupied' | 'all'>("all");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterAmenities, setFilterAmenities] = useState<string[]>([]);
  const [filterCleaningStatus, setFilterCleaningStatus] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Bulk Edit State
  const [selectedRoomIds, setSelectedRoomIds] = useState(new Set<string>());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditFloor, setBulkEditFloor] = useState<string>('');
  const [bulkEditAmenities, setBulkEditAmenities] = useState<string>('');
  const [bulkEditNotes, setBulkEditNotes] = useState<string>('');
  const [bulkEditCleaningStatus, setBulkEditCleaningStatus] = useState<string>('no-change');
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Import/Export state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Room Details state
  const [selectedRoomForDetails, setSelectedRoomForDetails] = useState<Room | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [roomReservations, setRoomReservations] = useState<Reservation[]>([]);
  const [roomMaintenanceLogs, setRoomMaintenanceLogs] = useState<any[]>([]);

  // View Mode state
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set([
    'name', 'type', 'floor', 'status', 'occupancy', 'amenities', 'notes'
  ]));
  const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);
  const [selectedRoomTimeline, setSelectedRoomTimeline] = useState<Room | null>(null);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [enableVirtualScroll, setEnableVirtualScroll] = useState(false);


  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      setRooms([]);
      setRoomTypes([]);
      setReservations([]);
      return;
    }

    setIsLoading(true);

    const roomTypesColRef = collection(db, "roomTypes");
    const rtq = query(roomTypesColRef, where("propertyId", "==", propertyId));
    const unsubRoomTypes = onSnapshot(rtq, (snapshot) => {
      setRoomTypes(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RoomType)));
    });

    const roomsColRef = collection(db, "rooms");
    const rq = query(roomsColRef, where("propertyId", "==", propertyId));
    const unsubRooms = onSnapshot(rq, (snapshot) => {
      setRooms(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Room)));
    });

    const reservationsColRef = collection(db, "reservations");
    const resq = query(reservationsColRef, where("propertyId", "==", propertyId));
    const unsubReservations = onSnapshot(resq, (snapshot) => {
        const fetchedReservations = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                startDate: (data.startDate as Timestamp).toDate(),
                endDate: (data.endDate as Timestamp).toDate(),
            } as Reservation;
        });
        setReservations(fetchedReservations);
    });

    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPropertySettings(docSnap.data() as Property);
      } else {
        setPropertySettings(null);
      }
      setIsLoading(false); 
    });

    return () => {
      unsubRoomTypes();
      unsubRooms();
      unsubReservations();
      unsubProp();
    };
  }, [propertyId]);

  const occupancyStatusMap = useMemo(() => {
    const today = startOfDay(new Date());
    const map = new Map<string, 'Occupied' | 'Available'>();
    const occupiedRoomIds = new Set<string>();

    reservations.forEach(res => {
        if (res.status !== 'Canceled' && res.status !== 'No-Show') {
            const checkIn = startOfDay(toDate(res.startDate) as Date);
            const checkOut = startOfDay(toDate(res.endDate) as Date);
            if (today >= checkIn && today < checkOut) {
                occupiedRoomIds.add(res.roomId);
            }
        }
    });
    
    rooms.forEach(room => {
        if (occupiedRoomIds.has(room.id)) {
            map.set(room.id, 'Occupied');
        } else {
            map.set(room.id, 'Available');
        }
    });

    return map;
  }, [rooms, reservations]);

  const availableRoomNumbers = useMemo(() => {
    if (!selectedRoomTypeId) {
        return [];
    }
    const roomType = roomTypes.find(rt => rt.id === selectedRoomTypeId);
    if (!roomType || !roomType.assignedRoomNumbers || roomType.assignedRoomNumbers.length === 0) {
        return [];
    }

    const assignedForThisType = roomType.assignedRoomNumbers;
    const usedNumbers = rooms.map(room => room.name);
    
    const available = assignedForThisType.filter(num => !usedNumbers.includes(num));
    
    return available.sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

  }, [selectedRoomTypeId, rooms, roomTypes]);

  useEffect(() => {
    if (editingRoom && selectedRoomTypeId === editingRoom.roomTypeId) {
        setRoomName(editingRoom.name);
    } else {
        setRoomName("");
    }
    setSelectedRoomNames([]); // Reset bulk selection on type change
  }, [selectedRoomTypeId, editingRoom]);


  const resetForm = () => {
    setSelectedRoomTypeId("");
    setRoomName("");
    setSelectedRoomNames([]);
    setFloor("");
    setAmenities("");
    setNotes("");
    setEditingRoom(null);
  };

  const handleOpenModal = (room: Room | null = null) => {
    resetForm();
    if (room) {
      setEditingRoom(room);
      setSelectedRoomTypeId(room.roomTypeId);
      setRoomName(room.name); 
      setFloor(room.floor || "");
      setAmenities(room.amenities?.join(', ') || "");
      setNotes(room.notes || "");
    }
    setIsModalOpen(true);
  };
  
  const handleRoomTypeChange = (value: string) => {
    setSelectedRoomTypeId(value);
  };

  const handleSaveRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (editingRoom) {
      // --- SINGLE EDIT LOGIC ---
      if (!propertyId || !roomName || !selectedRoomTypeId) {
        toast({ title: t('toasts.validation_error.title'), description: t('toasts.validation_error.single_edit_description'), variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const roomDataPayload: { [key: string]: any } = {
        name: roomName.trim(),
        roomTypeId: selectedRoomTypeId,
        amenities: amenities.split(',').map(a => a.trim()).filter(a => a),
        propertyId,
      };
      
      // Note: We are not updating 'status' here. That is for housekeeping.

      if (floor.trim()) roomDataPayload.floor = floor.trim();
      if (notes.trim()) roomDataPayload.notes = notes.trim();

      try {
        const docRef = doc(db, "rooms", editingRoom.id);
        await updateDoc(docRef, { ...roomDataPayload, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.success_title'), description: t('toasts.update_success_description') });
        setIsModalOpen(false);
        resetForm();
      } catch (error) {
        console.error("Error updating room:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.update_error_description'), variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    } else {
      // --- BULK CREATE LOGIC ---
      if (!propertyId || selectedRoomNames.length === 0 || !selectedRoomTypeId) {
        toast({ title: t('toasts.validation_error.title'), description: t('toasts.validation_error.bulk_create_description'), variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const batch = writeBatch(db);
        selectedRoomNames.forEach(name => {
          const newRoomRef = doc(collection(db, "rooms"));
          const roomDataPayload: { [key: string]: any } = {
            name: name.trim(),
            roomTypeId: selectedRoomTypeId,
            status: "Available", // New rooms default to Available
            propertyId,
            createdAt: serverTimestamp(),
          };
          if (floor.trim()) roomDataPayload.floor = floor.trim();
          if (notes.trim()) roomDataPayload.notes = notes.trim();
          if (amenities.trim()) roomDataPayload.amenities = amenities.split(',').map(a => a.trim()).filter(a => a);
          batch.set(newRoomRef, roomDataPayload);
        });
        await batch.commit();
        toast({ title: t('toasts.success_title'), description: t('toasts.create_success_description', { count: selectedRoomNames.length }) });
        setIsModalOpen(false);
        resetForm();
      } catch (error) {
        console.error("Error saving rooms:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.create_error_description'), variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteClick = (room: Room) => {
    setRoomToDelete(room);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenRoomDetails = async (room: Room) => {
    setSelectedRoomForDetails(room);
    setIsDetailsModalOpen(true);

    // Fetch recent reservations for this room
    const resQuery = query(
      collection(db, 'reservations'),
      where('roomId', '==', room.id),
      where('propertyId', '==', propertyId || '')
    );
    const resSnapshot = await getDocs(resQuery);
    const reservations = resSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate),
        endDate: data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate),
      } as Reservation;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    setRoomReservations(reservations);

    // Fetch maintenance logs if they exist
    const maintenanceQuery = query(
      collection(db, 'maintenanceLogs'),
      where('roomId', '==', room.id)
    );
    const maintenanceSnapshot = await getDocs(maintenanceQuery);
    const logs = maintenanceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    setRoomMaintenanceLogs(logs);
  };

  const handleOpenTimeline = async (room: Room) => {
    setSelectedRoomTimeline(room);
    setIsTimelineModalOpen(true);
  };

  const toggleColumn = (columnName: string) => {
    const newSet = new Set(selectedColumns);
    if (newSet.has(columnName)) {
      newSet.delete(columnName);
    } else {
      newSet.add(columnName);
    }
    setSelectedColumns(newSet);
  };

  const getOccupancyTimelineData = (room: Room) => {
    const upcomingReservations = reservations
      .filter(res => res.roomId === room.id && res.status !== 'Canceled' && res.status !== 'No-Show')
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 10);
    return upcomingReservations;
  };

  const getOccupancyPercentage = (room: Room) => {
    const nextMonthReservations = reservations.filter(res => {
      if (res.roomId !== room.id || res.status === 'Canceled' || res.status === 'No-Show') return false;
      const resStart = toDate(res.startDate) as Date;
      const now = new Date();
      const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return resStart >= now && resStart <= oneMonthFromNow;
    });
    
    if (nextMonthReservations.length === 0) return 0;
    let totalDays = 0;
    nextMonthReservations.forEach(res => {
      const start = toDate(res.startDate) as Date;
      const end = toDate(res.endDate) as Date;
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += days;
    });
    return Math.min(100, Math.round((totalDays / 30) * 100));
  };
  
  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "rooms", roomToDelete.id));
      toast({ title: t('toasts.success_title'), description: t('toasts.delete_success_description') });
    } catch (error) {
      console.error("Error deleting room:", error);
      toast({ title: t('toasts.error_title'), description: t('toasts.delete_error_description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setRoomToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleRowSelect = (roomId: string) => {
    setSelectedRoomIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

  const handleSelectAllForType = (roomIdsInType: string[], checked: boolean) => {
      setSelectedRoomIds(prev => {
          const newSet = new Set(prev);
          if (checked) {
              roomIdsInType.forEach(id => newSet.add(id));
          } else {
              roomIdsInType.forEach(id => newSet.delete(id));
          }
          return newSet;
      });
  };

  const handleBulkUpdate = async () => {
    if (selectedRoomIds.size === 0) return;

    const updates: { floor?: string; amenities?: string[]; notes?: string; cleaningStatus?: string } = {};
    if (bulkEditFloor.trim() !== '') {
        updates.floor = bulkEditFloor.trim();
    }
    if (bulkEditAmenities.trim() !== '') {
        updates.amenities = bulkEditAmenities.split(',').map(a => a.trim()).filter(a => a);
    }
    if (bulkEditNotes.trim() !== '') {
        updates.notes = bulkEditNotes.trim();
    }
    if (bulkEditCleaningStatus !== '' && bulkEditCleaningStatus !== 'no-change') {
        updates.cleaningStatus = bulkEditCleaningStatus;
    }

    if (Object.keys(updates).length === 0) {
        toast({ title: t('toasts.no_changes_title'), description: t('toasts.no_changes_description'), variant: "default" });
        return;
    }
      
    setIsLoading(true);
    const batch = writeBatch(db);
    selectedRoomIds.forEach(id => {
        const roomRef = doc(db, "rooms", id);
        batch.update(roomRef, { ...updates, updatedAt: serverTimestamp() });
    });

    try {
        await batch.commit();
        toast({ title: t('toasts.success_title'), description: t('toasts.bulk_update_success_description', { count: selectedRoomIds.size }) });
        setSelectedRoomIds(new Set());
        setIsBulkEditModalOpen(false);
        setBulkEditFloor('');
        setBulkEditAmenities('');
        setBulkEditNotes('');
        setBulkEditCleaningStatus('no-change');
    } catch (error) {
        console.error("Error performing bulk update:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.bulk_update_error_description'), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRoomIds.size === 0) return;
    if (!confirm(t('confirm_bulk_delete', { count: selectedRoomIds.size }))) {
        return;
    }
    setIsLoading(true);
    const batch = writeBatch(db);
    selectedRoomIds.forEach(id => {
      const roomRef = doc(db, "rooms", id);
      batch.delete(roomRef);
    });

    try {
      await batch.commit();
      toast({ title: t('toasts.success_title'), description: t('toasts.bulk_delete_success_description', { count: selectedRoomIds.size })});
      setSelectedRoomIds(new Set());
      setIsBulkEditModalOpen(false);
    } catch(error) {
      console.error("Error performing bulk delete:", error);
      toast({ title: t('toasts.error_title'), description: t('toasts.bulk_delete_error_description'), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Export rooms to CSV
  const handleExportCSV = () => {
    if (rooms.length === 0) {
      toast({ title: 'No data', description: 'No rooms to export', variant: 'default' });
      return;
    }

    const headers = ['Room Name', 'Room Type', 'Floor', 'Amenities', 'Notes', 'Cleaning Status'];
    const csvContent = [
      headers.join(','),
      ...rooms.map(room => {
        const roomType = roomTypes.find(rt => rt.id === room.roomTypeId)?.name || 'Unknown';
        const amenitiesStr = (room.amenities || []).join('; ');
        const notesStr = (room.notes || '').replace(/,/g, ';'); // Replace commas with semicolons to avoid CSV issues
        const cleaningStatus = room.cleaningStatus || 'N/A';
        
        return [
          `"${room.name}"`,
          `"${roomType}"`,
          room.floor || '',
          `"${amenitiesStr}"`,
          `"${notesStr}"`,
          cleaningStatus,
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rooms_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({ title: 'Success', description: `Exported ${rooms.length} rooms to CSV` });
  };

  // Import rooms from CSV
  const handleImportCSV = async (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setImportError('CSV file must contain header and at least one data row');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const typeIdx = headers.findIndex(h => h.includes('type'));
        const floorIdx = headers.findIndex(h => h.includes('floor'));
        const amenitiesIdx = headers.findIndex(h => h.includes('amenities'));
        const notesIdx = headers.findIndex(h => h.includes('notes'));

        if (nameIdx === -1 || typeIdx === -1) {
          setImportError('CSV must contain "Room Name" and "Room Type" columns');
          return;
        }

        setIsLoading(true);
        const batch = writeBatch(db);
        let importedCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          try {
            // Simple CSV parsing - split by comma but handle quoted fields
            const fields = lines[i]
              .split(',')
              .map(f => f.trim().replace(/^"|"$/g, ''));

            const roomName = fields[nameIdx];
            const roomTypeName = fields[typeIdx];

            if (!roomName || !roomTypeName) {
              errorCount++;
              continue;
            }

            // Find room type by name
            const roomType = roomTypes.find(rt => rt.name.toLowerCase() === roomTypeName.toLowerCase());
            if (!roomType) {
              errorCount++;
              continue;
            }

            const newRoom: Omit<Room, 'id'> = {
              name: roomName,
              roomTypeId: roomType.id,
              propertyId: propertyId || '',
              status: 'Available',
              cleaningStatus: 'clean',
              floor: floorIdx !== -1 ? fields[floorIdx] : undefined,
              amenities: amenitiesIdx !== -1 ? fields[amenitiesIdx].split(';').map(a => a.trim()).filter(a => a) : undefined,
              notes: notesIdx !== -1 ? fields[notesIdx] : undefined,
              createdAt: new Date(),
            };

            const newRoomRef = doc(collection(db, 'rooms'));
            batch.set(newRoomRef, { ...newRoom, createdAt: serverTimestamp() });
            importedCount++;
          } catch (err) {
            console.error(`Error processing row ${i + 1}:`, err);
            errorCount++;
          }
        }

        await batch.commit();
        setIsImportModalOpen(false);
        toast({
          title: 'Import Complete',
          description: `Imported ${importedCount} rooms${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
        });
      } catch (err) {
        console.error('Import error:', err);
        setImportError('Failed to process CSV file. Please check the format and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const getStatusBadgeClass = (status: 'Available' | 'Occupied'): string => {
    switch (status) {
      case "Available": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-500/50";
      case "Occupied": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-500/50";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500";
    }
  };

  const getAllFloors = useMemo(() => {
    const floors = new Set<string>();
    rooms.forEach(room => {
      if (room.floor) floors.add(room.floor.toString());
    });
    return Array.from(floors).sort((a, b) => {
      const numA = parseInt(a) || Infinity;
      const numB = parseInt(b) || Infinity;
      return numA - numB;
    });
  }, [rooms]);

  const getAllAmenities = useMemo(() => {
    const amenities = new Set<string>();
    rooms.forEach(room => {
      if (room.amenities) {
        room.amenities.forEach(a => amenities.add(a));
      }
    });
    return Array.from(amenities).sort();
  }, [rooms]);

  const groupedRooms = useMemo(() => {
    const filtered = rooms
      .filter(room => {
        // Search filter
        if (searchTerm !== "" && !room.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        // Room type filter
        if (filterRoomType !== "all" && room.roomTypeId !== filterRoomType) {
          return false;
        }
        
        // Occupancy status filter
        if (filterStatus !== "all" && occupancyStatusMap.get(room.id) !== filterStatus) {
          return false;
        }
        
        // Floor filter
        if (filterFloor !== "all" && (!room.floor || room.floor.toString() !== filterFloor)) {
          return false;
        }
        
        // Amenities filter
        if (filterAmenities.length > 0 && room.amenities) {
          const hasAllAmenities = filterAmenities.every(a => room.amenities?.includes(a));
          if (!hasAllAmenities) return false;
        }
        
        // Cleaning status filter
        if (filterCleaningStatus !== "all" && room.cleaningStatus !== filterCleaningStatus) {
          return false;
        }
        
        // Date range availability filter
        if (filterDateRange?.from && filterDateRange?.to) {
          const filterStart = startOfDay(filterDateRange.from);
          const filterEnd = startOfDay(filterDateRange.to);
          
          const isAvailableInRange = !reservations.some(res => {
            if (res.roomId !== room.id || res.status === 'Canceled' || res.status === 'No-Show') {
              return false;
            }
            const resStart = startOfDay(toDate(res.startDate) as Date);
            const resEnd = startOfDay(toDate(res.endDate) as Date);
            // Check if reservation overlaps with filter range
            return resStart < filterEnd && resEnd > filterStart;
          });
          
          if (!isAvailableInRange) return false;
        }
        
        return true;
      });
    
    const groupedByRoomType = filtered.reduce((acc, room) => {
        const typeId = room.roomTypeId;
        if (!acc[typeId]) {
            acc[typeId] = [];
        }
        acc[typeId].push(room);
        return acc;
    }, {} as Record<string, Room[]>);
    
    return roomTypes
        .map(rt => ({
            roomType: rt,
            rooms: (groupedByRoomType[rt.id] || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        }))
        .filter(group => group.rooms.length > 0)
        .sort((a, b) => a.roomType.name.localeCompare(b.roomType.name));

  }, [rooms, roomTypes, searchTerm, filterRoomType, filterStatus, occupancyStatusMap, filterFloor, filterAmenities, filterCleaningStatus, filterDateRange, reservations]);

  // Analytics/Stats calculations
  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = Array.from(occupancyStatusMap.values()).filter(status => status === 'Occupied').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Rooms by type breakdown
    const roomsByType = roomTypes.map(rt => {
      const typeRooms = rooms.filter(r => r.roomTypeId === rt.id);
      const typeOccupied = typeRooms.filter(r => occupancyStatusMap.get(r.id) === 'Occupied').length;
      return {
        name: rt.name,
        total: typeRooms.length,
        occupied: typeOccupied,
        occupancyRate: typeRooms.length > 0 ? Math.round((typeOccupied / typeRooms.length) * 100) : 0,
      };
    }).filter(item => item.total > 0);

    // Average occupancy by floor
    const occupancyByFloor = new Map<string, { total: number; occupied: number }>();
    rooms.forEach(room => {
      if (room.floor) {
        const floorStr = room.floor.toString();
        const current = occupancyByFloor.get(floorStr) || { total: 0, occupied: 0 };
        current.total++;
        if (occupancyStatusMap.get(room.id) === 'Occupied') {
          current.occupied++;
        }
        occupancyByFloor.set(floorStr, current);
      }
    });

    const occupancyByFloorArray = Array.from(occupancyByFloor.entries())
      .map(([floor, data]) => ({
        floor,
        total: data.total,
        occupied: data.occupied,
        occupancyRate: Math.round((data.occupied / data.total) * 100),
      }))
      .sort((a, b) => {
        const numA = parseInt(a.floor) || Infinity;
        const numB = parseInt(b.floor) || Infinity;
        return numA - numB;
      });

    return {
      totalRooms,
      occupiedRooms,
      occupancyRate,
      roomsByType,
      occupancyByFloor: occupancyByFloorArray,
    };
  }, [rooms, roomTypes, occupancyStatusMap]);

  // Calculate pagination
  const totalRoomsCount = groupedRooms.reduce((sum, group) => sum + group.rooms.length, 0);
  const totalPages = Math.ceil(totalRoomsCount / itemsPerPage);

  // Paginate the grouped rooms
  const paginatedGroupedRooms = useMemo(() => {
    if (totalRoomsCount === 0) return groupedRooms;
    
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    let roomCount = 0;
    const result: typeof groupedRooms = [];

    for (const group of groupedRooms) {
      const groupEndCount = roomCount + group.rooms.length;
      
      if (groupEndCount > startIdx && roomCount < endIdx) {
        // This group has rooms to display
        const groupStartIdx = Math.max(0, startIdx - roomCount);
        const groupEndIdx = Math.min(group.rooms.length, endIdx - roomCount);
        
        result.push({
          roomType: group.roomType,
          rooms: group.rooms.slice(groupStartIdx, groupEndIdx),
          _isPartial: groupStartIdx > 0 || groupEndIdx < group.rooms.length,
        } as any);
      }
      
      roomCount = groupEndCount;
      if (roomCount >= endIdx) break;
    }

    return result;
  }, [groupedRooms, currentPage, itemsPerPage, totalRoomsCount]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRoomType, filterStatus, filterFloor, filterAmenities, filterCleaningStatus, filterDateRange]);

  // Calculate active filters count
  const activeFiltersCount = [
    filterRoomType !== 'all' ? 1 : 0,
    filterStatus !== 'all' ? 1 : 0,
    filterFloor !== 'all' ? 1 : 0,
    filterCleaningStatus !== 'all' ? 1 : 0,
    filterAmenities.length > 0 ? 1 : 0,
    filterDateRange?.from ? 1 : 0,
  ].filter(Boolean).length;

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setFilterRoomType('all');
    setFilterStatus('all');
    setFilterFloor('all');
    setFilterCleaningStatus('all');
    setFilterAmenities([]);
    setFilterDateRange(undefined);
    setShowAdvancedFilters(false);
  };

  return (
    <div className="space-y-6">
      {/* Main Filter Bar */}
      <div className="space-y-3 p-4 border rounded-lg shadow-sm bg-card">
        {/* Search and Quick Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <Input 
              placeholder={t('filters.search_placeholder')}
              className="w-full" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex gap-1 border rounded-lg p-1 bg-muted">
              <Button
                size="sm"
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                onClick={() => setViewMode('card')}
                className="h-8 px-2"
                title="Card view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
                className="h-8 px-2"
                title="Table view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button 
              variant={showAdvancedFilters ? "default" : "outline"} 
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="relative"
            >
              <Icons.Settings className="mr-2 h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportCSV}
              className="hidden sm:inline-flex"
            >
              <Icons.Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Quick Filter Badges */}
        {(filterRoomType !== 'all' || filterStatus !== 'all') && (
          <div className="flex flex-wrap gap-2 items-center">
            {filterRoomType !== 'all' && (
              <Badge 
                variant="secondary" 
                className="pl-3 pr-1.5 py-1 cursor-pointer hover:bg-secondary/80 flex items-center gap-1.5"
                onClick={() => setFilterRoomType('all')}
              >
                {roomTypes.find(rt => rt.id === filterRoomType)?.name || 'Room Type'}
                <button className="text-xs hover:font-bold">×</button>
              </Badge>
            )}
            {filterStatus !== 'all' && (
              <Badge 
                variant="secondary" 
                className="pl-3 pr-1.5 py-1 cursor-pointer hover:bg-secondary/80 flex items-center gap-1.5"
                onClick={() => setFilterStatus('all')}
              >
                {filterStatus}
                <button className="text-xs hover:font-bold">×</button>
              </Badge>
            )}
            {activeFiltersCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Column Customizer and Import - Below Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        {/* Column Customizer - Only show in table view */}
        {viewMode === 'table' && (
          <Dialog open={isColumnCustomizerOpen} onOpenChange={setIsColumnCustomizerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Customize Table Columns</DialogTitle>
                <DialogDescription>
                  Select which columns to display in table view
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {[
                  { id: 'name', label: 'Room Name' },
                  { id: 'type', label: 'Room Type' },
                  { id: 'floor', label: 'Floor' },
                  { id: 'status', label: 'Status' },
                  { id: 'occupancy', label: 'Occupancy %' },
                  { id: 'amenities', label: 'Amenities' },
                  { id: 'notes', label: 'Notes' },
                ].map(column => (
                  <div key={column.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`col-${column.id}`}
                      checked={selectedColumns.has(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                    />
                    <label htmlFor={`col-${column.id}`} className="text-sm font-medium cursor-pointer">
                      {column.label}
                    </label>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
              <Icons.UploadCloud className="mr-2 h-4 w-4" />
              Import
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Rooms from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file with columns: Room Name, Room Type, Floor, Amenities, Notes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{importError}</p>
                </div>
              )}
              <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-6">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportCSV(file);
                      }
                    }}
                    disabled={isLoading}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <Icons.UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Click to select CSV file
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) resetForm(); }}>
            <DialogTrigger asChild>
                <Button onClick={() => handleOpenModal()}>
                <PlusCircle className="mr-2 h-4 w-4" /> {t('add_room_button')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleSaveRoom}>
                <DialogHeader>
                  <DialogTitle>{editingRoom ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
                  <DialogDescription>
                    {editingRoom 
                      ? t('edit_modal.description')
                      : t('add_modal.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="space-y-1">
                    <Label htmlFor="roomType">{t('form.room_type_label')} <span className="text-destructive">*</span></Label>
                    <Select value={selectedRoomTypeId} onValueChange={handleRoomTypeChange} required>
                        <SelectTrigger id="roomType"><SelectValue placeholder={t('form.room_type_placeholder')} /></SelectTrigger>
                        <SelectContent>
                        {roomTypes.length > 0 ? roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>) : 
                            <div className="p-2 text-center text-sm text-muted-foreground">
                                {t('form.no_room_types')}
                            </div>
                        }
                        </SelectContent>
                    </Select>
                  </div>

                  {editingRoom ? (
                    <>
                      <div className="space-y-1">
                          <Label htmlFor="roomNameEdit">{t('form.room_name_label_edit')} <span className="text-destructive">*</span></Label>
                          <Input id="roomNameEdit" value={roomName} onChange={e => setRoomName(e.target.value)} required />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label>{t('form.rooms_to_create_label')} <span className="text-destructive">*</span></Label>
                        <ScrollArea className="h-40 rounded-md border">
                            <div className="p-4">
                            {selectedRoomTypeId && availableRoomNumbers.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="select-all-rooms"
                                            checked={selectedRoomNames.length > 0 && selectedRoomNames.length === availableRoomNumbers.length}
                                            onCheckedChange={(checked) => setSelectedRoomNames(checked ? availableRoomNumbers : [])}
                                        />
                                        <Label htmlFor="select-all-rooms" className="font-semibold text-sm cursor-pointer">{t('form.select_all')}</Label>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {availableRoomNumbers.map(num => (
                                            <div key={num} className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`room-${num}`}
                                                    checked={selectedRoomNames.includes(num)}
                                                    onCheckedChange={(checked) => setSelectedRoomNames(prev => checked ? [...prev, num] : prev.filter(name => name !== num))}
                                                />
                                                <Label htmlFor={`room-${num}`} className="font-normal cursor-pointer">{num}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-sm text-muted-foreground text-center">
                                    {selectedRoomTypeId ? t('form.no_unassigned_rooms') : t('form.select_type_first')}
                                    </p>
                                </div>
                            )}
                            </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                                     
                  <div className="space-y-1">
                      <Label htmlFor="floor">{t('form.floor_label')}</Label>
                      <Input id="floor" value={floor} onChange={e => setFloor(e.target.value)} placeholder={t('form.floor_placeholder')} />
                      {!editingRoom && (
                          <p className="text-xs text-muted-foreground">{t('form.floor_description')}</p>
                      )}
                  </div>

                  <div className="space-y-1">
                      <Label htmlFor="amenities">{t('form.amenities_label')}</Label>
                      <Textarea id="amenities" value={amenities} onChange={e => setAmenities(e.target.value)} placeholder={t('form.amenities_placeholder')} />
                       <p className="text-xs text-muted-foreground">{t('form.amenities_description')}</p>
                  </div>

                  <div className="space-y-1">
                      <Label htmlFor="notes">{t('form.notes_label')}</Label>
                      <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('form.notes_placeholder')} />
                  </div>
                </div>
                <DialogFooter className="sm:justify-start pt-2 border-t">
                    <DialogClose asChild><Button type="button" variant="secondary">{t('buttons.close')}</Button></DialogClose>
                    <Button type="submit" disabled={isLoading || roomTypes.length === 0}>
                        {(isLoading && roomTypes.length > 0) && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                        {editingRoom ? t('buttons.save_changes') : t('buttons.create_rooms', { count: selectedRoomNames.length > 0 ? selectedRoomNames.length : '' })}
                    </Button>
                </DialogFooter>
              </form>
            </DialogContent>
        </Dialog>
      </div>

      {showAdvancedFilters && (
        <div className="p-4 border rounded-lg shadow-sm bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Room Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Room Type</Label>
              <Select value={filterRoomType} onValueChange={setFilterRoomType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'Available' | 'Occupied' | "all")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Occupied">Occupied</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Floor Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Floor</Label>
              <Select value={filterFloor} onValueChange={setFilterFloor}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {getAllFloors.map(floor => (
                    <SelectItem key={floor} value={floor}>Floor {floor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cleaning Status Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Cleaning</Label>
              <Select value={filterCleaningStatus} onValueChange={setFilterCleaningStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="clean">Clean</SelectItem>
                  <SelectItem value="dirty">Dirty</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="out_of_order">Out of Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amenities and Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Amenities Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Amenities</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between h-9">
                    <span>{filterAmenities.length > 0 ? `${filterAmenities.length} selected` : 'Choose amenities'}</span>
                    {filterAmenities.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">{filterAmenities.length}</Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter by Amenities</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-60 rounded-md border p-4">
                    <div className="space-y-3">
                      {getAllAmenities.map(amenity => (
                        <div key={amenity} className="flex items-center space-x-2">
                          <Checkbox
                            id={`amenity-${amenity}`}
                            checked={filterAmenities.includes(amenity)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilterAmenities([...filterAmenities, amenity]);
                              } else {
                                setFilterAmenities(filterAmenities.filter(a => a !== amenity));
                              }
                            }}
                          />
                          <Label htmlFor={`amenity-${amenity}`} className="font-normal cursor-pointer">
                            {amenity}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button 
                      variant="secondary" 
                      onClick={() => setFilterAmenities([])}
                      size="sm"
                    >
                      Clear
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between h-9 text-left">
                    <span>
                      {filterDateRange?.from ? (
                        filterDateRange.to ? (
                          <>
                            {format(filterDateRange.from, "MMM dd")} - {format(filterDateRange.to, "MMM dd")}
                          </>
                        ) : (
                          format(filterDateRange.from, "MMM dd")
                        )
                      ) : (
                        "Pick dates"
                      )}
                    </span>
                    {filterDateRange?.from && (
                      <Badge variant="secondary" className="text-xs">✓</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={filterDateRange?.from}
                    selected={filterDateRange}
                    onSelect={setFilterDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Active Filters Display and Clear Button */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
              <span className="text-xs font-medium text-muted-foreground">Active filters:</span>
              <div className="flex flex-wrap gap-2">
                {filterRoomType !== 'all' && (
                  <Badge 
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10 px-2.5 py-1 text-xs"
                    onClick={() => setFilterRoomType('all')}
                  >
                    {roomTypes.find(rt => rt.id === filterRoomType)?.name}
                    <span className="ml-1.5 font-bold">×</span>
                  </Badge>
                )}
                {filterStatus !== 'all' && (
                  <Badge 
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10 px-2.5 py-1 text-xs"
                    onClick={() => setFilterStatus('all')}
                  >
                    {filterStatus}
                    <span className="ml-1.5 font-bold">×</span>
                  </Badge>
                )}
                {filterFloor !== 'all' && (
                  <Badge 
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10 px-2.5 py-1 text-xs"
                    onClick={() => setFilterFloor('all')}
                  >
                    Floor {filterFloor}
                    <span className="ml-1.5 font-bold">×</span>
                  </Badge>
                )}
                {filterCleaningStatus !== 'all' && (
                  <Badge 
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10 px-2.5 py-1 text-xs"
                    onClick={() => setFilterCleaningStatus('all')}
                  >
                    {filterCleaningStatus}
                    <span className="ml-1.5 font-bold">×</span>
                  </Badge>
                )}
                {filterAmenities.length > 0 && (
                  <Badge 
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10 px-2.5 py-1 text-xs"
                    onClick={() => setFilterAmenities([])}
                  >
                    {filterAmenities.length} amenities
                    <span className="ml-1.5 font-bold">×</span>
                  </Badge>
                )}
                {filterDateRange?.from && (
                  <Badge 
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10 px-2.5 py-1 text-xs"
                    onClick={() => setFilterDateRange(undefined)}
                  >
                    Date Range
                    <span className="ml-1.5 font-bold">×</span>
                  </Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAllFilters}
                className="ml-auto text-xs text-muted-foreground hover:text-destructive"
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      )}

       {selectedRoomIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border animate-in fade-in-50">
            <p className="text-sm font-medium">{t('bulk_actions.selected_rooms', { count: selectedRoomIds.size })}</p>
            <Dialog open={isBulkEditModalOpen} onOpenChange={(isOpen) => { setIsBulkEditModalOpen(isOpen); if(!isOpen) { setBulkEditFloor(''); } }}>
                <DialogTrigger asChild>
                    <Button size="sm">
                        <Icons.Edit className="mr-2 h-4 w-4" />
                        {t('bulk_actions.button')}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('bulk_edit_modal.title')}</DialogTitle>
                        <DialogDescription>
                           {t('bulk_edit_modal.description', { count: selectedRoomIds.size })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto">
                        <div className="space-y-1">
                            <Label htmlFor="bulkFloor">{t('bulk_edit_modal.new_floor_label')}</Label>
                            <Input
                                id="bulkFloor"
                                value={bulkEditFloor}
                                onChange={(e) => setBulkEditFloor(e.target.value)}
                                placeholder={t('bulk_edit_modal.new_floor_placeholder')}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="bulkAmenities">Amenities (comma-separated)</Label>
                            <Textarea
                                id="bulkAmenities"
                                value={bulkEditAmenities}
                                onChange={(e) => setBulkEditAmenities(e.target.value)}
                                placeholder="Add amenities to all selected rooms (e.g., WiFi, TV, AC)"
                                className="resize-none"
                                rows={2}
                            />
                            <p className="text-xs text-muted-foreground">Leave empty to not change amenities</p>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="bulkNotes">Notes</Label>
                            <Textarea
                                id="bulkNotes"
                                value={bulkEditNotes}
                                onChange={(e) => setBulkEditNotes(e.target.value)}
                                placeholder="Add notes to all selected rooms"
                                className="resize-none"
                                rows={2}
                            />
                            <p className="text-xs text-muted-foreground">Leave empty to not change notes</p>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="bulkCleaningStatus">Cleaning Status</Label>
                            <Select value={bulkEditCleaningStatus} onValueChange={setBulkEditCleaningStatus}>
                              <SelectTrigger id="bulkCleaningStatus">
                                <SelectValue placeholder="No change" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no-change">No change</SelectItem>
                                <SelectItem value="clean">Clean</SelectItem>
                                <SelectItem value="dirty">Dirty</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="out_of_order">Out of Order</SelectItem>
                              </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 border-t">
                        <Button variant="destructive" onClick={handleBulkDelete} disabled={isLoading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('buttons.delete_selected')}
                        </Button>
                        <Button onClick={handleBulkUpdate} disabled={isLoading}>
                           {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                           {t('buttons.update_rooms')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      )}
      
      {isLoading && (
        <div className="flex justify-center items-center h-64"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>
      )}

      {!isLoading && groupedRooms.length > 0 && (
        <div className="space-y-8">
            {paginatedGroupedRooms.map(({ roomType, rooms: groupRooms }) => {
                const roomIdsInThisGroup = groupRooms.map(r => r.id);
                const areAllInGroupSelected = roomIdsInThisGroup.length > 0 && roomIdsInThisGroup.every(id => selectedRoomIds.has(id));
                const areSomeInGroupSelected = roomIdsInThisGroup.some(id => selectedRoomIds.has(id));

                return (
                    <div key={roomType.id}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold tracking-tight">{roomType.name}</h2>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`select-all-${roomType.id}`}
                                        checked={areAllInGroupSelected ? true : areSomeInGroupSelected ? 'indeterminate' : false}
                                        onCheckedChange={(checked) => handleSelectAllForType(roomIdsInThisGroup, Boolean(checked))}
                                    />
                                    <Label htmlFor={`select-all-${roomType.id}`} className="text-sm font-normal">
                                        {t('select_all_label')}
                                    </Label>
                                </div>
                                <Badge variant="secondary">{groupRooms.length} {groupRooms.length === 1 ? t('room_badge_single') : t('room_badge_plural')}</Badge>
                            </div>
                        </div>

                        {/* Card View */}
                        {viewMode === 'card' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[calc(100vh-200px)] overflow-y-auto p-1">
                            {groupRooms.map(room => {
                                const occupancyStatus = occupancyStatusMap.get(room.id) || 'Available';
                                const occupancyPercent = getOccupancyPercentage(room);
                                return (
                                <Card 
                                    key={room.id} 
                                    className={cn(
                                        "flex flex-col justify-between shadow-md hover:shadow-lg transition-all relative cursor-pointer overflow-hidden",
                                        selectedRoomIds.has(room.id) && "ring-2 ring-primary ring-offset-2"
                                    )}
                                    onClick={() => handleRowSelect(room.id)}
                                >
                                    {/* Room Image/Thumbnail */}
                                    {room.imageUrl && (
                                        <div className="relative w-full h-32 bg-muted overflow-hidden">
                                            <img 
                                                src={room.imageUrl} 
                                                alt={room.name}
                                                className="w-full h-full object-cover hover:scale-105 transition-transform"
                                            />
                                            <div className="absolute inset-0 bg-black/20" />
                                        </div>
                                    )}
                                    
                                    <div className="absolute top-3 left-3 z-10">
                                        <Checkbox
                                            checked={selectedRoomIds.has(room.id)}
                                            onCheckedChange={() => handleRowSelect(room.id)}
                                            aria-label={t('select_room_aria_label', { roomName: room.name })}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div>
                                        <CardHeader className={cn("flex flex-row justify-between items-start pb-2 pl-12", room.imageUrl ? "pt-2" : "")}>
                                            <div className="flex-1">
                                                <CardTitle className="text-xl font-bold">{room.name}</CardTitle>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {roomTypes.find(rt => rt.id === room.roomTypeId)?.name || 'Unknown Type'}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={cn("capitalize font-semibold text-xs", getStatusBadgeClass(occupancyStatus))}>
                                                {t(`occupancy_status.${occupancyStatus.toLowerCase()}`)}
                                            </Badge>
                                        </CardHeader>
                                        <CardContent className="space-y-2 pb-4 pl-12">
                                            <p className="text-sm text-muted-foreground">
                                                {t('card.floor_label')}: {room.floor || 'N/A'}
                                            </p>
                                            {occupancyPercent > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold">Next 30d: {occupancyPercent}% booked</p>
                                                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500"
                                                            style={{ width: `${occupancyPercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {room.amenities && room.amenities.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold text-foreground">Amenities:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {room.amenities.slice(0, 3).map((amenity, idx) => (
                                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                                {amenity}
                                                            </Badge>
                                                        ))}
                                                        {room.amenities.length > 3 && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                +{room.amenities.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {room.notes && (
                                                <p className="text-xs text-muted-foreground italic line-clamp-2">
                                                    <span className="font-semibold">Notes:</span> {room.notes}
                                                </p>
                                            )}
                                        </CardContent>
                                    </div>
                                    <CardFooter className="flex justify-end gap-2 pl-12">
                                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenTimeline(room); }} title="View timeline">
                                            <Icons.TrendingUp className="h-4 w-4" />
                                            <span className="sr-only">View occupancy timeline</span>
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(room); }} title="View details">
                                            <Icons.Eye className="h-4 w-4" />
                                            <span className="sr-only">View room details</span>
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenModal(room); }} title={t('card.manage_button')}>
                                            <Icons.Settings className="h-4 w-4" />
                                            <span className="sr-only">{t('manage_button_sr')}</span>
                                        </Button>
                                        <Button variant="outline" size="icon" className="text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); handleDeleteClick(room); }} title={t('card.delete_button')}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">{t('delete_button_sr')}</span>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            )})}
                        </div>
                        )}

                        {/* Table View */}
                        {viewMode === 'table' && (
                        <div className="border rounded-lg overflow-hidden">
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    checked={areAllInGroupSelected ? true : areSomeInGroupSelected ? 'indeterminate' : false}
                                                    onCheckedChange={(checked) => handleSelectAllForType(roomIdsInThisGroup, Boolean(checked))}
                                                />
                                            </TableHead>
                                            {selectedColumns.has('name') && <TableHead>Room Name</TableHead>}
                                            {selectedColumns.has('type') && <TableHead>Type</TableHead>}
                                            {selectedColumns.has('floor') && <TableHead>Floor</TableHead>}
                                            {selectedColumns.has('status') && <TableHead>Status</TableHead>}
                                            {selectedColumns.has('occupancy') && <TableHead>Next 30d</TableHead>}
                                            {selectedColumns.has('amenities') && <TableHead>Amenities</TableHead>}
                                            {selectedColumns.has('notes') && <TableHead>Notes</TableHead>}
                                            <TableHead className="w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupRooms.map(room => {
                                            const occupancyStatus = occupancyStatusMap.get(room.id) || 'Available';
                                            const occupancyPercent = getOccupancyPercentage(room);
                                            return (
                                                <TableRow 
                                                    key={room.id}
                                                    className={cn(
                                                        "hover:bg-muted/50",
                                                        selectedRoomIds.has(room.id) && "bg-primary/10"
                                                )}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedRoomIds.has(room.id)}
                                                        onCheckedChange={() => handleRowSelect(room.id)}
                                                    />
                                                </TableCell>
                                                {selectedColumns.has('name') && (
                                                    <TableCell className="font-medium">{room.name}</TableCell>
                                                )}
                                                {selectedColumns.has('type') && (
                                                    <TableCell>{roomTypes.find(rt => rt.id === room.roomTypeId)?.name}</TableCell>
                                                )}
                                                {selectedColumns.has('floor') && (
                                                    <TableCell>{room.floor || 'N/A'}</TableCell>
                                                )}
                                                {selectedColumns.has('status') && (
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn("text-xs", getStatusBadgeClass(occupancyStatus))}>
                                                            {occupancyStatus}
                                                        </Badge>
                                                    </TableCell>
                                                )}
                                                {selectedColumns.has('occupancy') && (
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 min-w-max">
                                                            <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-blue-500"
                                                                    style={{ width: `${occupancyPercent}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs">{occupancyPercent}%</span>
                                                        </div>
                                                    </TableCell>
                                                )}
                                                {selectedColumns.has('amenities') && (
                                                    <TableCell>
                                                        {room.amenities && room.amenities.length > 0 ? (
                                                            <div className="flex gap-1 flex-wrap max-w-xs">
                                                                {room.amenities.slice(0, 2).map((a, idx) => (
                                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                                        {a}
                                                                    </Badge>
                                                                ))}
                                                                {room.amenities.length > 2 && (
                                                                    <span className="text-xs text-muted-foreground">+{room.amenities.length - 2}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {selectedColumns.has('notes') && (
                                                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                                        {room.notes || '-'}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => handleOpenTimeline(room)}
                                                            title="Timeline"
                                                        >
                                                            <Icons.TrendingUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => handleOpenRoomDetails(room)}
                                                            title="Details"
                                                        >
                                                            <Icons.Eye className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            </div>
                        </div>
                        )}
                    </div>
                );
            })}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && groupedRooms.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalRoomsCount)}</span> of <span className="font-semibold">{totalRoomsCount}</span> rooms
            </div>
            <Select value={itemsPerPage.toString()} onValueChange={(val) => {
              setItemsPerPage(parseInt(val));
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 per page</SelectItem>
                <SelectItem value="12">12 per page</SelectItem>
                <SelectItem value="24">24 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </Button>
            <div className="flex items-center gap-2 px-3">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + idx;
                }
                if (pageNum > totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && <span className="px-2">...</span>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
      
      {!isLoading && rooms.length === 0 && (
         <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                {t('no_rooms_found')}
              </p>
            </CardContent>
        </Card>
       )}

      {!isLoading && rooms.length > 0 && groupedRooms.length === 0 && (
         <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                {t('no_rooms_match_filters')}
              </p>
            </CardContent>
        </Card>
       )}
       
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_delete_description', { name: roomToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoomToDelete(null)}>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoom} disabled={isLoading}>
                {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Room Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRoomForDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedRoomForDetails.name}</DialogTitle>
                <DialogDescription>
                  {roomTypes.find(rt => rt.id === selectedRoomForDetails.roomTypeId)?.name} • Floor {selectedRoomForDetails.floor || 'N/A'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Room Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Room Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Room Type</p>
                      <p className="font-medium">{roomTypes.find(rt => rt.id === selectedRoomForDetails.roomTypeId)?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Floor</p>
                      <p className="font-medium">{selectedRoomForDetails.floor || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={cn(getStatusBadgeClass(occupancyStatusMap.get(selectedRoomForDetails.id) || 'Available'))}>
                        {occupancyStatusMap.get(selectedRoomForDetails.id) || 'Available'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cleaning Status</p>
                      <Badge variant="outline" className="capitalize">{selectedRoomForDetails.cleaningStatus || 'N/A'}</Badge>
                    </div>
                  </div>
                  
                  {selectedRoomForDetails.amenities && selectedRoomForDetails.amenities.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Amenities</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRoomForDetails.amenities.map((amenity, idx) => (
                          <Badge key={idx} variant="secondary">{amenity}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRoomForDetails.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm">{selectedRoomForDetails.notes}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Recent Reservations */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Recent Reservations</h3>
                  {roomReservations.length > 0 ? (
                    <ScrollArea className="h-48 rounded-lg border p-4">
                      <div className="space-y-3">
                        {roomReservations.slice(0, 5).map(res => (
                          <div key={res.id} className="pb-3 border-b last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-medium text-sm">{res.guestName || 'Guest'}</p>
                              <Badge variant="outline" className="text-xs capitalize">{res.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(toDate(res.startDate) as Date, 'MMM dd, yyyy')} → {format(toDate(res.endDate) as Date, 'MMM dd, yyyy')}
                            </p>
                            {res.notes && <p className="text-xs text-muted-foreground mt-1">Note: {res.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reservations found</p>
                  )}
                </div>

                <Separator />

                {/* Maintenance Logs */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Maintenance Logs</h3>
                  {roomMaintenanceLogs.length > 0 ? (
                    <ScrollArea className="h-48 rounded-lg border p-4">
                      <div className="space-y-3">
                        {roomMaintenanceLogs.slice(0, 5).map(log => (
                          <div key={log.id} className="pb-3 border-b last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-medium text-sm">{log.type || 'Maintenance'}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(toDate(log.createdAt) as Date, 'MMM dd, yyyy')}
                              </p>
                            </div>
                            {log.description && <p className="text-xs">{log.description}</p>}
                            {log.assignedTo && <p className="text-xs text-muted-foreground">Assigned: {log.assignedTo}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No maintenance logs found</p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <DialogFooter className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleOpenModal(selectedRoomForDetails)}
                >
                  <Icons.Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setRoomToDelete(selectedRoomForDetails);
                    setIsDeleteDialogOpen(true);
                  }}
                  className="text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Copy room ID to clipboard
                    navigator.clipboard.writeText(selectedRoomForDetails.id);
                    toast({ title: 'Copied', description: 'Room ID copied to clipboard' });
                  }}
                >
                  <Icons.Copy className="mr-2 h-4 w-4" />
                  Copy ID
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Occupancy Timeline Modal */}
      <Dialog open={isTimelineModalOpen} onOpenChange={setIsTimelineModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedRoomTimeline && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedRoomTimeline.name} - Occupancy Timeline</DialogTitle>
                <DialogDescription>
                  Upcoming reservations for the next 3 months
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <p className="text-xs text-muted-foreground">Next 30 Days</p>
                    <p className="text-lg font-bold">{getOccupancyPercentage(selectedRoomTimeline)}%</p>
                    <p className="text-xs text-muted-foreground">Booked</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total Reservations</p>
                    <p className="text-lg font-bold">{getOccupancyTimelineData(selectedRoomTimeline).length}</p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <p className="text-xs text-muted-foreground">Current Status</p>
                    <Badge className={cn(getStatusBadgeClass(occupancyStatusMap.get(selectedRoomTimeline.id) || 'Available'))}>
                      {occupancyStatusMap.get(selectedRoomTimeline.id) || 'Available'}
                    </Badge>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <p className="text-xs text-muted-foreground">Cleaning Status</p>
                    <Badge variant="outline" className="capitalize">
                      {selectedRoomTimeline.cleaningStatus || 'Unknown'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Timeline View */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Reservation Timeline</h3>
                  {getOccupancyTimelineData(selectedRoomTimeline).length > 0 ? (
                    <ScrollArea className="h-96 rounded-lg border p-4 bg-muted/30">
                      <div className="space-y-3">
                        {getOccupancyTimelineData(selectedRoomTimeline).map((res, idx) => {
                          const startDate = toDate(res.startDate) as Date;
                          const endDate = toDate(res.endDate) as Date;
                          const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                          const isUpcoming = startDate > new Date();
                          const isActive = startDate <= new Date() && endDate > new Date();
                          
                          return (
                            <div 
                              key={res.id} 
                              className={cn(
                                "p-3 rounded-lg border-l-4",
                                isActive && "bg-blue-50 border-l-blue-500 dark:bg-blue-950",
                                isUpcoming && "bg-green-50 border-l-green-500 dark:bg-green-950",
                                !isActive && !isUpcoming && "bg-gray-50 border-l-gray-500 dark:bg-gray-950"
                              )}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium">{res.guestName || 'Guest'}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(startDate, 'MMM dd, yyyy')} → {format(endDate, 'MMM dd, yyyy')}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {days} night{days !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge 
                                    variant={isActive ? "default" : "outline"}
                                    className={cn(
                                      isActive && "bg-blue-600",
                                      isUpcoming && "bg-green-600"
                                    )}
                                  >
                                    {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Past'}
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Visual Timeline Bar */}
                              <div className="w-full h-1 bg-muted rounded-full mt-2 mb-2" />
                              
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>Status: <span className="capitalize font-medium">{res.status}</span></p>
                                {res.notes && <p>Note: {res.notes}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="p-8 border rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No upcoming reservations</p>
                    </div>
                  )}
                </div>

                {/* Monthly Breakdown */}
                {getOccupancyTimelineData(selectedRoomTimeline).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Monthly Forecast</h3>
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, monthIdx) => {
                          const monthDate = new Date();
                          monthDate.setMonth(monthDate.getMonth() + monthIdx);
                          const monthReservations = getOccupancyTimelineData(selectedRoomTimeline).filter(res => {
                            const resDate = toDate(res.startDate) as Date;
                            return resDate.getMonth() === monthDate.getMonth() && resDate.getFullYear() === monthDate.getFullYear();
                          });
                          const monthDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                          const occupiedDays = monthReservations.reduce((sum, res) => {
                            const start = toDate(res.startDate) as Date;
                            const end = toDate(res.endDate) as Date;
                            let count = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            if (start.getMonth() !== monthDate.getMonth()) {
                              const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                              count = daysInMonth - start.getDate();
                            }
                            return sum + Math.min(count, monthDays);
                          }, 0);
                          const occupancyPercent = Math.round((occupiedDays / monthDays) * 100);

                          return (
                            <div key={monthIdx} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">
                                  {format(monthDate, 'MMMM yyyy')}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {occupancyPercent}% ({occupiedDays}/{monthDays} days)
                                </span>
                              </div>
                              <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                                  style={{ width: `${occupancyPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => handleOpenModal(selectedRoomTimeline)}
                >
                  <Icons.Edit className="mr-2 h-4 w-4" />
                  Edit Room
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setIsTimelineModalOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

