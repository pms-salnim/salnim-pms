'use client';

import React, { useState, useMemo } from 'react';
import { Calendar, RotateCcw, Check } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/toast/toast-container';
import { BulkAvailabilityPanel } from '@/components/bulk-availability/bulk-availability-panel';
import { BulkAvailabilityCalendar } from '@/components/bulk-availability/bulk-availability-calendar';
import { UpdatePreviewModal } from '@/components/bulk-availability/update-preview-modal';

// Demo data
const DEMO_ROOM_TYPES = [
  { id: 'deluxe', name: 'Deluxe King Room' },
  { id: 'executive', name: 'Executive Suite' },
  { id: 'standard', name: 'Standard Room' },
];

const DEMO_ROOMS = {
  deluxe: [
    { id: 'R-101', name: 'R-101' },
    { id: 'R-102', name: 'R-102' },
    { id: 'R-103', name: 'R-103' },
  ],
  executive: [
    { id: 'R-201', name: 'R-201' },
    { id: 'R-202', name: 'R-202' },
  ],
  standard: [
    { id: 'R-301', name: 'R-301' },
    { id: 'R-302', name: 'R-302' },
    { id: 'R-303', name: 'R-303' },
    { id: 'R-304', name: 'R-304' },
  ],
};

const DEMO_CHANNELS = [
  { id: 'all', name: 'All Channels' },
  { id: 'booking', name: 'Booking Engine' },
  { id: 'otas', name: 'All OTAs' },
];

const DEMO_AVAILABILITY_OPTIONS = [
  { id: 'available', label: 'Available', color: '#10b981' }, // green
  { id: 'stop_sell', label: 'Stop Sell', color: '#ef4444', hasReason: true }, // red
  { id: 'close_arrival', label: 'Close to Arrival', color: '#f97316' }, // orange
  { id: 'close_departure', label: 'Close to Departure', color: '#8b5cf6' }, // purple
  { id: 'min_stay', label: 'Min Stay', color: '#3b82f6', hasNights: true }, // blue
  { id: 'max_stay', label: 'Max Stay', color: '#06b6d4', hasNights: true }, // cyan
];

const generateDateRange = (days = 14) => {
  const dates = [];
  const startDate = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

function BulkAvailabilityPageContent() {
  const { addToast } = useToast();
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
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set(DEMO_ROOM_TYPES.map(rt => rt.id)));
  const [startDate, setStartDate] = useState(new Date());
  const [roomSearchFilter, setRoomSearchFilter] = useState('');
  const [minStayNights, setMinStayNights] = useState('');
  const [maxStayNights, setMaxStayNights] = useState('');

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
      return Object.values(DEMO_ROOMS).flat();
    }
    return DEMO_ROOMS[selectedRoomType as keyof typeof DEMO_ROOMS] || [];
  }, [selectedRoomType]);

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
    setExpandedRoomTypes(new Set(DEMO_ROOM_TYPES.map(rt => rt.id)));
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

  const handleUpdate = () => {
    // Use effective rooms and dates from left panel, or manually selected cells as fallback
    let roomsToUpdate: string[] = [];
    let datesToUpdate: number[] = [];

    if (effectiveRooms.length > 0 && selectedAvailability.length > 0) {
      // Use left panel selection
      roomsToUpdate = effectiveRooms;
      datesToUpdate = effectiveDateIndices;
    } else if (selectedCells.size > 0) {
      // Fallback to manually selected cells
      roomsToUpdate = Array.from(selectedCells.keys());
      datesToUpdate = Array.from(
        new Set(
          Array.from(selectedCells.values()).flatMap(dateSet => Array.from(dateSet))
        )
      );
    } else {
      addToast('Please select rooms and an availability option, or manually select cells', 'info');
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

    // Calculate room-by-room date ranges
    const roomDateRanges: Record<string, string[]> = {};
    
    if (selectedCells.size > 0) {
      // Use manually selected cells
      selectedCells.forEach((dateIndices, roomId) => {
        const sortedIndices = Array.from(dateIndices).sort((a, b) => a - b);
        const ranges: string[] = [];
        let rangeStart = sortedIndices[0];
        let rangeEnd = sortedIndices[0];

        for (let i = 1; i < sortedIndices.length; i++) {
          if (sortedIndices[i] === rangeEnd + 1) {
            rangeEnd = sortedIndices[i];
          } else {
            const startDate = dates[rangeStart];
            const endDate = dates[rangeEnd];
            const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
            const endStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
            ranges.push(rangeStart === rangeEnd ? startStr : `${startStr}-${endStr}`);
            rangeStart = sortedIndices[i];
            rangeEnd = sortedIndices[i];
          }
        }

        const startDate = dates[rangeStart];
        const endDate = dates[rangeEnd];
        const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
        const endStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
        ranges.push(rangeStart === rangeEnd ? startStr : `${startStr}-${endStr}`);

        roomDateRanges[roomId] = ranges;
      });
    } else if (effectiveRooms.length > 0 && effectiveDateIndices.length > 0) {
      // Use left panel selection - generate ranges for all rooms with all effective dates
      const sortedIndices = Array.from(effectiveDateIndices).sort((a, b) => a - b);
      const ranges: string[] = [];
      let rangeStart = sortedIndices[0];
      let rangeEnd = sortedIndices[0];

      for (let i = 1; i < sortedIndices.length; i++) {
        if (sortedIndices[i] === rangeEnd + 1) {
          rangeEnd = sortedIndices[i];
        } else {
          const startDate = dates[rangeStart];
          const endDate = dates[rangeEnd];
          const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
          const endStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
          ranges.push(rangeStart === rangeEnd ? startStr : `${startStr}-${endStr}`);
          rangeStart = sortedIndices[i];
          rangeEnd = sortedIndices[i];
        }
      }

      const startDate = dates[rangeStart];
      const endDate = dates[rangeEnd];
      const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
      const endStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
      ranges.push(rangeStart === rangeEnd ? startStr : `${startStr}-${endStr}`);

      // Apply same date ranges to all effective rooms
      effectiveRooms.forEach(roomId => {
        roomDateRanges[roomId] = ranges;
      });
    }

    // Get availability label and color
    const selectedAvailOpt = DEMO_AVAILABILITY_OPTIONS.find(
      opt => opt.id === selectedAvailability[0]
    );
    const availabilityLabel = selectedAvailOpt?.label || 'Unknown';
    const availabilityColor = selectedAvailOpt?.color || '#000000';

    const updateData = {
      totalCells,
      uniqueRooms: roomsToUpdate.length,
      uniqueDates: datesToUpdate.length,
      availabilityLabel,
      availabilityColor,
      stopSellReason: selectedAvailability.includes('stop_sell') ? stopSellReason : undefined,
      roomsList,
      datesList,
      roomDateRanges: Object.keys(roomDateRanges).length > 0 ? roomDateRanges : undefined,
    };

    setPendingUpdate(updateData);
    setShowPreviewModal(true);
  };

  const confirmUpdate = async () => {
    setIsSubmitting(true);
    try {
      // Recalculate effective selections
      let roomsToUpdate: string[] = [];
      let datesToUpdate: number[] = [];

      if (effectiveRooms.length > 0 && selectedAvailability.length > 0) {
        roomsToUpdate = effectiveRooms;
        datesToUpdate = effectiveDateIndices;
      } else {
        roomsToUpdate = Array.from(selectedCells.keys());
        datesToUpdate = Array.from(
          new Set(
            Array.from(selectedCells.values()).flatMap(dateSet => Array.from(dateSet))
          )
        );
      }

      const selectedCount = roomsToUpdate.length * datesToUpdate.length;
      
      console.log('Confirmed update with:', {
        dateRange,
        selectedDays: selectAllDays ? 'all' : selectedDays,
        selectedChannels,
        selectedRoomType,
        selectedRooms: selectAllRooms ? 'all' : selectedRooms,
        selectedAvailability,
        stopSellReason: selectedAvailability.includes('stop_sell') ? stopSellReason : undefined,
        selectedCells: Object.fromEntries(selectedCells),
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setShowPreviewModal(false);
      setPendingUpdate(null);
      setSelectedCells(new Map());
      addToast(`✅ Successfully updated ${selectedCount} cells!`, 'success');
    } catch (error) {
      console.error('Update failed:', error);
      addToast('Failed to update. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <div className="min-h-screen min-w-screen bg-gradient-to-br from-slate-50 to-slate-100 ">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Bulk Availability Manager
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Update availability and rates across multiple rooms and dates</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* Left Panel - Controls */}
        <div className="w-1/4 border-r border-slate-200 bg-white overflow-y-auto">
          <BulkAvailabilityPanel
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            selectedDays={selectedDays}
            onSelectedDaysChange={setSelectedDays}
            selectAllDays={selectAllDays}
            onSelectAllDaysChange={setSelectAllDays}
            selectedChannels={selectedChannels}
            onSelectedChannelsChange={setSelectedChannels}
            channels={DEMO_CHANNELS}
            selectedRoomType={selectedRoomType}
            onSelectedRoomTypeChange={setSelectedRoomType}
            roomTypes={DEMO_ROOM_TYPES}
            selectedRooms={selectedRooms}
            onSelectedRoomsChange={setSelectedRooms}
            selectAllRooms={selectAllRooms}
            onSelectAllRoomsChange={setSelectAllRooms}
            availableRooms={availableRooms}
            selectedAvailability={selectedAvailability}
            onSelectedAvailabilityChange={setSelectedAvailability}
            availabilityOptions={DEMO_AVAILABILITY_OPTIONS}
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

        {/* Right Panel - Calendar */}
        <div className="flex-1 bg-slate-50 overflow-auto">
          <BulkAvailabilityCalendar
            dates={dates}
            roomTypes={DEMO_ROOM_TYPES}
            rooms={DEMO_ROOMS}
            selectedAvailability={selectedAvailability}
            availabilityOptions={DEMO_AVAILABILITY_OPTIONS}
            selectedRoomType={selectedRoomType}
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
          />
        </div>
      </div>

      {/* Update Preview Modal */}
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
