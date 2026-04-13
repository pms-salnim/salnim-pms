'use client';

import React, { useState, useMemo, useEffect, Suspense, memo, lazy } from 'react';
import dynamic from 'next/dynamic';
import { Calendar, RotateCcw, Check, Settings, X, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ToastProvider, useToast } from '@/components/toast/toast-container';
import { BulkAvailabilityPanel } from '@/components/bulk-availability/bulk-availability-panel';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { getFiveYearEndDate } from '@/lib/availability-service';

// Lazy load heavy components
const BulkAvailabilityCalendar = dynamic(
  () => import('@/components/bulk-availability/bulk-availability-calendar').then(mod => ({ default: mod.BulkAvailabilityCalendar })),
  { loading: () => <CalendarLoadingFallback />, ssr: false }
);

const UpdatePreviewModal = dynamic(
  () => import('@/components/bulk-availability/update-preview-modal').then(mod => ({ default: mod.UpdatePreviewModal })),
  { ssr: false }
);

// Loading fallback component
const CalendarLoadingFallback = () => (
  <div className="flex items-center justify-center h-96 bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <Loader className="w-6 h-6 text-blue-600 animate-spin" />
      <p className="text-sm text-slate-600">Loading calendar...</p>
    </div>
  </div>
);

// Map UI availability IDs to database status values
const mapAvailabilityIdToStatus = (id: string): string => {
  const mapping: Record<string, string> = {
    available: 'available',
    stop_sell: 'not_available',
    close_arrival: 'closed_to_arrival',
    close_departure: 'closed_to_departure',
    min_stay: 'available', // min_stay is stored in min_nights field
    max_stay: 'available', // max_stay is stored in max_nights field
  };
  return mapping[id] || 'available';
};

const CHANNELS = [
  { id: 'all', name: 'All Channels' },
  { id: 'booking', name: 'Booking Engine' },
  { id: 'otas', name: 'All OTAs' },
];

const AVAILABILITY_OPTIONS = [
  { id: 'available', label: 'Available', color: '#10b981' }, // green
  { id: 'stop_sell', label: 'Stop Sell', color: '#ef4444', hasReason: true }, // red
  { id: 'close_arrival', label: 'Close to Arrival', color: '#f97316' }, // orange
  { id: 'close_departure', label: 'Close to Departure', color: '#8b5cf6' }, // purple
  { id: 'min_stay', label: 'Min Stay', color: '#3b82f6', hasNights: true }, // blue
  { id: 'max_stay', label: 'Max Stay', color: '#06b6d4', hasNights: true }, // cyan
];

const ratesDiscountsSubtabs = [
  { id: 'rates', label: 'Rate Plans', href: '/property-settings/rates-discounts/rates' },
  { id: 'seasonal', label: 'Seasonal Pricing', href: '/property-settings/rates-discounts/seasonal' },
  { id: 'discounts', label: 'Discounts', href: '/property-settings/rates-discounts/discounts' },
  { id: 'availability', label: 'Availability', href: '/property-settings/rates-discounts/availability' },
];

// Memoized Panel Component
const BulkAvailabilityPanelMemo = memo(BulkAvailabilityPanel);

function BulkAvailabilityPageContent() {
  const { user, property, isLoadingAuth } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [roomTypes, setRoomTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [rooms, setRooms] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const propertyId = property?.id;
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0-6 for days of week
  const [selectAllDays, setSelectAllDays] = useState(true);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['all']);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectAllRooms, setSelectAllRooms] = useState(true);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [stopSellReason, setStopSellReason] = useState('');
  const [selectedCells, setSelectedCells] = useState<Map<string, Set<number>>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ roomId: string; dateIndex: number } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set(roomTypes.map(rt => rt.id)));
  const [startDate, setStartDate] = useState(new Date());
  const [roomSearchFilter, setRoomSearchFilter] = useState('');
  const [minStayNights, setMinStayNights] = useState('');
  const [maxStayNights, setMaxStayNights] = useState('');
  const [openEnded, setOpenEnded] = useState(true); // Default to open-ended for backward compatibility
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger to refresh calendar after updates
  const [showSettingsPanel, setShowSettingsPanel] = useState(false); // Toggle settings dropdown

  // Load room types and rooms from Supabase based on propertyId
  useEffect(() => {
    const loadPropertyData = async () => {
      try {
        if (isLoadingAuth) {
          return;
        }

        if (!propertyId) {
          addToast('Property ID not found', 'error');
          setIsLoading(false);
          return;
        }

        // Fetch room types from API
        const roomTypesResponse = await fetch(
          `/api/property-settings/rates-availability/room-types?propertyId=${propertyId}`
        );
        
        if (!roomTypesResponse.ok) {
          throw new Error('Failed to fetch room types');
        }
        
        const { data: fetchedRoomTypes } = await roomTypesResponse.json();
        setRoomTypes(fetchedRoomTypes || []);

        // Fetch rooms from API
        const roomsResponse = await fetch(
          `/api/property-settings/rates-availability/rooms?propertyId=${propertyId}`
        );
        
        if (!roomsResponse.ok) {
          throw new Error('Failed to fetch rooms');
        }
        
        const { data: fetchedRooms } = await roomsResponse.json();
        console.log('Fetched rooms:', fetchedRooms);
        
        // Group rooms by room type ID
        const groupedRooms: Record<string, Array<{ id: string; name: string }>> = {};
        
        // First, create empty arrays for all room types
        (fetchedRoomTypes || []).forEach((rt: any) => {
          groupedRooms[rt.id] = [];
        });
        
        // Then add rooms to their respective room types
        (fetchedRooms || []).forEach((room: any) => {
          const typeId = room.room_type_id;
          if (typeId && groupedRooms[typeId]) {
            groupedRooms[typeId].push({ id: room.id, name: room.number || room.name });
          } else if (typeId) {
            // Create group if room type exists in data but not initialized
            if (!groupedRooms[typeId]) {
              groupedRooms[typeId] = [];
            }
            groupedRooms[typeId].push({ id: room.id, name: room.number || room.name });
          }
        });
        
        console.log('Grouped rooms:', groupedRooms);
        
        setRooms(groupedRooms);
        setExpandedRoomTypes(new Set((fetchedRoomTypes || []).map((rt: any) => rt.id)));
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load property data:', error);
        addToast('Failed to load property data. Please try again.', 'error');
        setIsLoading(false);
      }
    };

    loadPropertyData();
  }, [propertyId, isLoadingAuth, addToast]);

  const dates = useMemo(() => {
    const dateList = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dateList.push(date);
    }
    return dateList;
  }, [startDate]);

  // Handle date navigation
  const handleNextDay = () => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + 1);
    setStartDate(next);
  };

  const handlePrevDay = () => {
    const prev = new Date(startDate);
    prev.setDate(startDate.getDate() - 1);
    setStartDate(prev);
  };

  const handleGoToToday = () => {
    setStartDate(new Date());
  };

  const handleGoToNextWeek = () => {
    const nextWeek = new Date(startDate);
    nextWeek.setDate(startDate.getDate() + 7);
    setStartDate(nextWeek);
  };

  const handleGoToNextMonth = () => {
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(startDate.getMonth() + 1);
    setStartDate(nextMonth);
  };

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setStartDate(newDate);
    }
  };

  // Get rooms for selected room type
  const availableRooms = useMemo(() => {
    if (selectedRoomType === 'all') {
      return Object.values(rooms).flat();
    }
    return rooms[selectedRoomType as keyof typeof rooms] || [];
  }, [selectedRoomType, rooms]);

  // Determine which rooms will be affected by update based on left panel selection
  const effectiveRooms = useMemo(() => {
    if (selectAllRooms) {
      return availableRooms.map(r => r.id);
    }
    return selectedRooms;
  }, [selectAllRooms, selectedRooms, availableRooms]);

  // Determine which date indices will be affected based on left panel day selection
  const effectiveDateIndices = useMemo(() => {
    if (selectAllDays) {
      return Array.from({ length: dates.length }, (_, i) => i);
    }
    // Filter dates by selected days of week
    return Array.from({ length: dates.length }, (_, i) => i).filter(idx => {
      const dayOfWeek = dates[idx].getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0-6 (Mon-Sun)
      return selectedDays.includes(dayIndex);
    });
  }, [dates, selectAllDays, selectedDays]);

  // Get selected date ranges from manually selected cells
  const selectedDateRanges = useMemo(() => {
    if (selectedCells.size === 0) return [];
    
    // Get all unique date indices from selected cells
    const allSelectedIndices = new Set<number>();
    selectedCells.forEach(dateSet => {
      dateSet.forEach(dateIdx => allSelectedIndices.add(dateIdx));
    });

    const sortedIndices = Array.from(allSelectedIndices).sort((a, b) => a - b);
    if (sortedIndices.length === 0) return [];

    // Group consecutive dates into ranges
    const ranges: string[] = [];
    let rangeStart = sortedIndices[0];
    let rangeEnd = sortedIndices[0];

    for (let i = 1; i < sortedIndices.length; i++) {
      if (sortedIndices[i] === rangeEnd + 1) {
        // Continue the range
        rangeEnd = sortedIndices[i];
      } else {
        // End the current range and start a new one
        const startDate = dates[rangeStart];
        const endDate = dates[rangeEnd];
        const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
        const endStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
        ranges.push(rangeStart === rangeEnd ? startStr : `${startStr}-${endStr}`);
        rangeStart = sortedIndices[i];
        rangeEnd = sortedIndices[i];
      }
    }

    // Add the last range
    const startDate = dates[rangeStart];
    const endDate = dates[rangeEnd];
    const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
    const endStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
    ranges.push(rangeStart === rangeEnd ? startStr : `${startStr}-${endStr}`);

    return ranges;
  }, [selectedCells, dates]);

  const handleReset = () => {
    setDateRange({ start: null, end: null });
    setSelectedDays([]);
    setSelectAllDays(true);
    setSelectedChannels(['all']);
    setSelectedRoomType('all');
    setSelectedRooms([]);
    setSelectAllRooms(true);
    setSelectedAvailability([]);
    setStopSellReason('');
    setMinStayNights('');
    setMaxStayNights('');
    setSelectedCells(new Map());
  };

  const handleToggleRoomType = (roomTypeId: string) => {
    const newExpanded = new Set(expandedRoomTypes);
    if (newExpanded.has(roomTypeId)) {
      newExpanded.delete(roomTypeId);
    } else {
      newExpanded.add(roomTypeId);
    }
    setExpandedRoomTypes(newExpanded);
  };

  const handleExpandAll = () => {
    setExpandedRoomTypes(new Set(roomTypes.map(rt => rt.id)));
  };

  const handleCollapseAll = () => {
    setExpandedRoomTypes(new Set());
  };

  const handleCellClick = (roomId: string, dateIndex: number, event: React.MouseEvent) => {
    if (!selectedAvailability.length) return;
    
    const newSelectedCells = new Map(selectedCells);
    const cellSet = newSelectedCells.get(roomId) || new Set();
    
    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      if (cellSet.has(dateIndex)) {
        cellSet.delete(dateIndex);
      } else {
        cellSet.add(dateIndex);
      }
    } else if (event.shiftKey) {
      // Range select with Shift - requires dragStart
      if (dragStart && dragStart.roomId === roomId) {
        const start = Math.min(dragStart.dateIndex, dateIndex);
        const end = Math.max(dragStart.dateIndex, dateIndex);
        for (let i = start; i <= end; i++) {
          cellSet.add(i);
        }
        setDragStart(null);
      }
    } else {
      // Single click - toggle or add
      if (cellSet.has(dateIndex)) {
        cellSet.delete(dateIndex);
      } else {
        cellSet.add(dateIndex);
      }
    }
    
    if (cellSet.size > 0) {
      newSelectedCells.set(roomId, cellSet);
    } else {
      newSelectedCells.delete(roomId);
    }
    setSelectedCells(newSelectedCells);
  };

  const handleCellDragStart = (roomId: string, dateIndex: number) => {
    if (!selectedAvailability.length) return;
    setDragStart({ roomId, dateIndex });
    setIsDragging(true);
  };

  const handleCellDragOver = (roomId: string, dateIndex: number) => {
    if (!isDragging || !dragStart) return;
    
    // Only allow range selection within same room
    if (dragStart.roomId !== roomId) return;
    
    const newSelectedCells = new Map(selectedCells);
    const cellSet = new Set<number>();
    
    const start = Math.min(dragStart.dateIndex, dateIndex);
    const end = Math.max(dragStart.dateIndex, dateIndex);
    
    for (let i = start; i <= end; i++) {
      cellSet.add(i);
    }
    
    newSelectedCells.set(roomId, cellSet);
    setSelectedCells(newSelectedCells);
  };

  const handleCellDragEnd = () => {
    setIsDragging(false);
  };

  // Helper function to get readable room label: "Room Type name : Room Number/name"
  const getRoomLabel = (roomId: string): string => {
    // Find which room type contains this room
    for (const typeId in rooms) {
      const roomsInType = rooms[typeId];
      const room = roomsInType.find(r => r.id === roomId);
      if (room) {
        const roomTypeName = roomTypes.find(rt => rt.id === typeId)?.name || 'Unknown Type';
        const roomName = room.name;
        return `${roomTypeName} : ${roomName}`;
      }
    }
    return roomId; // Fallback to room ID if not found
  };

  const handleUpdate = () => {
    // Validate date range when using panel selection
    if (selectedAvailability.length > 0) {
      if (!dateRange.start) {
        addToast('Please select a start date', 'info');
        return;
      }
      if (!openEnded && !dateRange.end) {
        addToast('Please select an end date or enable "Open-ended"', 'info');
        return;
      }
    }

    // Use manually selected cells (priority), or date range picker, or left panel selection as fallback
    let roomsToUpdate: string[] = [];
    let datesToUpdate: number[] = [];

    if (selectedCells.size > 0) {
      // Priority 1: Use manually selected cells (dragging on calendar)
      roomsToUpdate = Array.from(selectedCells.keys());
      datesToUpdate = Array.from(
        new Set(
          Array.from(selectedCells.values()).flatMap(dateSet => Array.from(dateSet))
        )
      );
    } else if (dateRange.start && (dateRange.end || openEnded)) {
      // Priority 2: Use date range picker selection
      // Convert dateRange start/end to date indices
      const rangeStart = new Date(dateRange.start);
      rangeStart.setHours(0, 0, 0, 0);
      
      const rangeEnd = dateRange.end ? new Date(dateRange.end) : null;
      if (rangeEnd) {
        rangeEnd.setHours(0, 0, 0, 0);
      }
      
      datesToUpdate = Array.from({ length: dates.length }, (_, i) => i).filter(idx => {
        const currentDate = new Date(dates[idx]);
        currentDate.setHours(0, 0, 0, 0);
        
        const isAfterStart = currentDate.getTime() >= rangeStart.getTime();
        const isBeforeOrOnEnd = rangeEnd === null || currentDate.getTime() <= rangeEnd.getTime();
        
        return isAfterStart && isBeforeOrOnEnd;
      });
      
      // Use left panel selected rooms if available, otherwise all rooms
      roomsToUpdate = effectiveRooms.length > 0 ? effectiveRooms : Array.from(selectedRooms.keys());
    } else if (effectiveRooms.length > 0 && selectedAvailability.length > 0) {
      // Priority 3: Fallback to left panel selection (day of week + room selection)
      roomsToUpdate = effectiveRooms;
      datesToUpdate = effectiveDateIndices;
    } else {
      addToast('Please select rooms and an availability option, or manually select cells, or use date range picker', 'info');
      return;
    }

    const totalCells = roomsToUpdate.length * datesToUpdate.length;
    
    if (totalCells === 0) {
      addToast('Please select at least one cell to update', 'info');
      return;
    }

    // Get room names and date strings
    const roomsList = roomsToUpdate.sort();
    const datesList = datesToUpdate
      .sort((a, b) => a - b)
      .map(idx => {
        const date = dates[idx];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        return `${dayName} ${dayNum} ${month}`;
      });

    // Get availability label and color
    const selectedAvailOpt = AVAILABILITY_OPTIONS.find(
      opt => opt.id === selectedAvailability[0]
    );
    const availabilityLabel = selectedAvailOpt?.label || 'Unknown';
    const availabilityColor = selectedAvailOpt?.color || '#000000';
    const databaseStatus = mapAvailabilityIdToStatus(selectedAvailability[0]);

    // Convert date indices to actual date strings (ISO YYYY-MM-DD format)
    // This prevents the bug where indices point to wrong dates if calendar view changes
    const selectedDateStrings = datesToUpdate.map(idx => dates[idx].toISOString().split('T')[0]);

    // Calculate room-by-room date ranges DIRECTLY from selectedDateStrings
    const roomDateRanges: Record<string, string[]> = {};
    
    // Convert selected date strings to Date objects for grouping
    const selectedDatesAsObjects = selectedDateStrings
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime());
    
    // Helper to format date as DD/MM/YYYY
    const formatDateString = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };
    
    // Group selected dates into contiguous ranges
    const dateRanges: string[] = [];
    if (selectedDatesAsObjects.length > 0) {
      let rangeStart = selectedDatesAsObjects[0];
      let rangeEnd = selectedDatesAsObjects[0];
      
      for (let i = 1; i < selectedDatesAsObjects.length; i++) {
        const currentDate = selectedDatesAsObjects[i];
        const prevDate = selectedDatesAsObjects[i - 1];
        const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (Math.abs(dayDiff - 1) < 0.1) {  // Contiguous
          rangeEnd = currentDate;
        } else {
          // Gap detected - save current range
          const startStr = formatDateString(rangeStart.toISOString().split('T')[0]);
          if (rangeStart.getTime() === rangeEnd.getTime()) {
            // Single day in this gap range
            dateRanges.push(openEnded ? `${startStr} - Open-ended (Five years)` : startStr);
          } else {
            // Multiple days in this gap range
            const endStr = formatDateString(rangeEnd.toISOString().split('T')[0]);
            dateRanges.push(openEnded ? `${startStr} - Open-ended (Five years)` : `${startStr}-${endStr}`);
          }
          
          rangeStart = currentDate;
          rangeEnd = currentDate;
        }
      }
      
      // Add final range (check if open-ended)
      const startStr = formatDateString(rangeStart.toISOString().split('T')[0]);
      if (rangeStart.getTime() === rangeEnd.getTime()) {
        // Single day
        dateRanges.push(openEnded ? `${startStr} - Open-ended (Five years)` : startStr);
      } else {
        // Multiple days
        const endStr = formatDateString(rangeEnd.toISOString().split('T')[0]);
        dateRanges.push(openEnded ? `${startStr} - Open-ended (Five years)` : `${startStr}-${endStr}`);
      }
    }
    
    // Apply same date ranges to all rooms being updated
    roomsToUpdate.forEach(roomId => {
      roomDateRanges[roomId] = dateRanges;
    });

    // Transform roomDateRanges to use readable room labels instead of IDs
    const readableRoomDateRanges: Record<string, string[]> = {};
    Object.entries(roomDateRanges).forEach(([roomId, ranges]) => {
      const readableLabel = getRoomLabel(roomId);
      readableRoomDateRanges[readableLabel] = ranges;
    });

    const updateData = {
      totalCells,
      uniqueRooms: roomsToUpdate.length,
      uniqueDates: datesToUpdate.length,
      availabilityLabel,
      availabilityColor,
      stopSellReason: selectedAvailability.includes('stop_sell') ? stopSellReason : undefined,
      roomsList,
      datesList,
      roomDateRanges: Object.keys(readableRoomDateRanges).length > 0 ? readableRoomDateRanges : undefined,
      // Store additional data for confirmUpdate
      _internalData: {
        roomsToUpdate,
        selectedDateStrings,  // Use date strings instead of indices
        status: databaseStatus,
        minNights: selectedAvailability.includes('min_stay') ? parseInt(minStayNights) || 1 : 1,
        maxNights: selectedAvailability.includes('max_stay') ? parseInt(maxStayNights) || null : null,
      },
    };

    setPendingUpdate(updateData);
    setShowPreviewModal(true);
  };

  const confirmUpdate = async () => {
    setIsSubmitting(true);
    try {
      if (!pendingUpdate?._internalData || !propertyId) {
        throw new Error('Missing update data');
      }

      const { roomsToUpdate, selectedDateStrings, status, minNights, maxNights } = pendingUpdate._internalData;
      
      // Convert date strings to Date objects for sorting
      const selectedDates = selectedDateStrings
        .map((dateStr: string) => new Date(dateStr))
        .sort((a, b) => a.getTime() - b.getTime());
      
      const selectedCount = roomsToUpdate.length * selectedDates.length;

      // Determine effective end date (5 years from today if open-ended)
      const effectiveEndDate = openEnded ? getFiveYearEndDate() : selectedDates[selectedDates.length - 1]?.toISOString().split('T')[0];

      // Transform dates to YYYY-MM-DD format and detect contiguous ranges
      // IMPORTANT: Detect contiguous date ranges to send as single records (not expanded)
      const availabilities = [];
      
      for (const roomId of roomsToUpdate) {
        // Check if selected dates form contiguous ranges
        const dateRanges: Array<{ startIdx: number; endIdx: number }> = [];
        
        if (selectedDates.length > 0) {
          let rangeStart = 0;
          let rangeEnd = 0;
          
          for (let i = 1; i < selectedDates.length; i++) {
            const dayDiff = (selectedDates[i].getTime() - selectedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
            if (Math.abs(dayDiff - 1) < 0.1) {  // Allow for timezone differences
              // Contiguous - extend range
              rangeEnd = i;
            } else {
              // Gap detected - save current range and start new one
              dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
              rangeStart = i;
              rangeEnd = i;
            }
          }
          // Don't forget the last range
          dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
        }
        
        // Create one availability entry per contiguous range
        for (const range of dateRanges) {
          const startDate = selectedDates[range.startIdx];
          const endDate = selectedDates[range.endIdx];
          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          
          // Build availability object - only include fields that have values
          const availObj: any = {
            date: startDateStr,
            status,
            roomId,
            occupancy: 1,
            appliedAtLevel: 'room',
          };

          // Add end date if this is a range (more than 1 day) or if open-ended
          if (range.endIdx > range.startIdx || effectiveEndDate) {
            availObj.endDate = effectiveEndDate || endDateStr;
          }
          
          // Only add optional fields if they have values
          if (minNights !== undefined && minNights > 0) availObj.minNights = minNights;
          if (maxNights !== undefined && maxNights > 0) availObj.maxNights = maxNights;
          if (selectedAvailability.includes('stop_sell') && stopSellReason) {
            availObj.notes = stopSellReason;
          }

          availabilities.push(availObj);
        }
      }

      // Call the availability API endpoint
      console.log('[confirmUpdate] Sending payload with', availabilities.length, 'availability updates (ranges detected and merged)');
      console.log('[confirmUpdate] Sample updates:', availabilities.slice(0, 3));
      
      // For large batches, split into chunks to avoid timeout
      const BATCH_SIZE = 150;  // Process 150 records at a time
      const batches = [];
      
      for (let i = 0; i < availabilities.length; i += BATCH_SIZE) {
        batches.push(availabilities.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`[confirmUpdate] Splitting ${availabilities.length} records into ${batches.length} batches of max ${BATCH_SIZE}`);
      
      let totalRecordsUpserted = 0;
      const allAffectedRooms = new Set<string>();
      
      // Process each batch sequentially
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`[confirmUpdate] Processing batch ${batchIdx + 1}/${batches.length} with ${batch.length} records...`);
        
        const response = await fetch('/api/property-settings/rates-availability/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            availabilities: batch,
          }),
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { error: `HTTP ${response.status}` };
          }
          
          console.error(`[confirmUpdate] Batch ${batchIdx + 1} failed:`, errorData);
          throw new Error(
            errorData.error || 
            errorData.message ||
            `Batch ${batchIdx + 1} failed (HTTP ${response.status})`
          );
        }

        const result = await response.json();
        console.log(`[confirmUpdate] Batch ${batchIdx + 1} success:`, result.data);
        
        totalRecordsUpserted += result.data?.recordsUpserted || 0;
        if (result.data?.affectedRooms) {
          result.data.affectedRooms.forEach(r => allAffectedRooms.add(r));
        }
      }

      console.log(`[confirmUpdate] All batches completed. Total upserted: ${totalRecordsUpserted}`);
      
      setShowPreviewModal(false);
      setPendingUpdate(null);
      setSelectedCells(new Map());
      // Trigger calendar refresh to fetch updated data
      setRefreshTrigger(prev => prev + 1);
      addToast(`✅ Successfully updated ${totalRecordsUpserted} records!`, 'success');
    } catch (error) {
      console.error('Update failed:', error);
      addToast(
        `Failed to update availability: ${(error as Error).message}`,
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600 font-medium">Loading property data...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className=" border-b border-slate-200 shadow-sm z-40 flex-shrink-0">
        <div className="px-8 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                <Calendar className="w-6 h-6 text-blue-600" />
                Availability Manager
              </h1>
            <div className="relative">
                <button
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                  title="Edit Settings"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                
                
                {/* Dropdown Panel */}
                {showSettingsPanel && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-96 max-h-96 overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Settings</h3>
                      <button
                        onClick={() => setShowSettingsPanel(false)}
                        className="text-slate-400 hover:text-slate-600 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="px-4 py-3">
                      <BulkAvailabilityPanelMemo
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                        openEnded={openEnded}
                        onOpenEndedChange={setOpenEnded}
                        selectedDays={selectedDays}
                        onSelectedDaysChange={setSelectedDays}
                        selectAllDays={selectAllDays}
                        onSelectAllDaysChange={setSelectAllDays}
                        selectedChannels={selectedChannels}
                        onSelectedChannelsChange={setSelectedChannels}
                        channels={CHANNELS}
                        selectedRoomType={selectedRoomType}
                        onSelectedRoomTypeChange={setSelectedRoomType}
                        roomTypes={roomTypes}
                        selectedRooms={selectedRooms}
                        onSelectedRoomsChange={setSelectedRooms}
                        selectAllRooms={selectAllRooms}
                        onSelectAllRoomsChange={setSelectAllRooms}
                        availableRooms={availableRooms}
                        selectedAvailability={selectedAvailability}
                        onSelectedAvailabilityChange={setSelectedAvailability}
                        availabilityOptions={AVAILABILITY_OPTIONS}
                        stopSellReason={stopSellReason}
                        onStopSellReasonChange={setStopSellReason}
                        onUpdate={handleUpdate}
                        onReset={handleReset}
                        roomSearchFilter={roomSearchFilter}
                        onRoomSearchFilterChange={setRoomSearchFilter}
                        minStayNights={minStayNights}
                        onMinStayNightsChange={setMinStayNights}
                        maxStayNights={maxStayNights}
                        onMaxStayNightsChange={setMaxStayNights}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <PropertySettingsSubtabs subtabs={ratesDiscountsSubtabs} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 w-full min-h-0 overflow-hidden">
        
        {/* Right Panel - Calendar */}
        <div className="flex-1 min-w-0 w-0 bg-slate-50 overflow-x-auto overflow-y-auto">
          <div className="h-full flex flex-col">
            <Suspense fallback={<CalendarLoadingFallback />}>
              <BulkAvailabilityCalendar
                dates={dates}
                roomTypes={roomTypes}
                rooms={rooms}
                selectedAvailability={selectedAvailability}
                availabilityOptions={AVAILABILITY_OPTIONS}
                selectedRoomType={selectedRoomType}
                propertyId={propertyId}
                selectedCells={selectedCells}
                expandedRoomTypes={expandedRoomTypes}
                onToggleRoomType={handleToggleRoomType}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onCellClick={handleCellClick}
                onCellDragStart={handleCellDragStart}
                onCellDragOver={handleCellDragOver}
                onCellDragEnd={handleCellDragEnd}
                onPrevDay={handlePrevDay}
                onNextDay={handleNextDay}
                onGoToToday={handleGoToToday}
                onGoToNextWeek={handleGoToNextWeek}
                onGoToNextMonth={handleGoToNextMonth}
                onCustomDateChange={handleCustomDateChange}
                startDate={startDate}
                selectedDateRanges={selectedDateRanges}
                refreshTrigger={refreshTrigger}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Update Preview Modal */}
      <Suspense fallback={null}>
        <UpdatePreviewModal
          isOpen={showPreviewModal}
          updateData={pendingUpdate}
          onConfirm={confirmUpdate}
          onCancel={() => {
            setShowPreviewModal(false);
            setPendingUpdate(null);
          }}
          isLoading={isSubmitting}
        />
      </Suspense>
    </div>
  );
}

export default function BulkAvailabilityPage() {
  return (
    <ToastProvider>
      <BulkAvailabilityPageContent />
    </ToastProvider>
  );
}
