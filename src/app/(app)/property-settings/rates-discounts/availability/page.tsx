'use client';

import React, { useState, useMemo, useEffect, Suspense, memo, lazy } from 'react';
import dynamic from 'next/dynamic';
import { Calendar, RotateCcw, Check, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ToastProvider, useToast } from '@/components/toast/toast-container';
import { BulkAvailabilityPanel } from '@/components/bulk-availability/bulk-availability-panel';
import { AvailabilitySettingsForm } from '@/components/bulk-availability/availability-settings-form';
import { RestrictionsSettingsForm } from '@/components/bulk-availability/restrictions-settings-form';
import { RatesSettingsForm } from '@/components/bulk-availability/rates-settings-form';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { getFiveYearEndDate } from '@/lib/availability-service';
import { createClient } from '@supabase/supabase-js';
import type { RatePlan } from '@/types/ratePlan';

// Lazy load heavy components
const BulkAvailabilityCalendar = dynamic(
  () => import('@/components/bulk-availability/bulk-availability-calendar').then(mod => ({ default: mod.BulkAvailabilityCalendar })),
  { loading: () => <CalendarLoadingFallback />, ssr: false }
);

// Initialize Supabase client for authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  const [roomTypes, setRoomTypes] = useState<Array<{ 
    id: string; 
    name: string; 
    minStay?: number; 
    maxStay?: number;
    restrictions?: Array<{ 
      date: string; 
      end_date: string | null; 
      min_nights: number | null; 
      max_nights: number | null; 
      close_to_arrival: boolean | null; 
      close_to_departure: boolean | null;
      override_type?: 'percentage' | 'fixed' | null;
      override_value?: number | null;
    }>;
  }>>([]);
  const [rooms, setRooms] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
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
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set()); // All collapsed by default
  const [startDate, setStartDate] = useState(new Date());
  const [roomSearchFilter, setRoomSearchFilter] = useState('');
  const [minStayNights, setMinStayNights] = useState('');
  const [maxStayNights, setMaxStayNights] = useState('');
  const [openEnded, setOpenEnded] = useState(true); // Default to open-ended for backward compatibility
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger to refresh calendar after updates
  const [showSettingsPanel, setShowSettingsPanel] = useState(false); // Toggle settings dropdown
  const [selectedSettingTab, setSelectedSettingTab] = useState<'availability' | 'restrictions' | 'rates' | null>(null); // Which settings tab is active
  const [rateOverrideType, setRateOverrideType] = useState<'none' | 'percentage' | 'fixed'>('none'); // Rate override type
  const [rateOverrideValue, setRateOverrideValue] = useState<number>(0); // Percentage (0-100) or fixed price
  const [closeToArrival, setCloseToArrival] = useState(false); // Close to Arrival restriction
  const [closeToDeparture, setCloseToDeparture] = useState(false); // Close to Departure restriction
  const [minStay, setMinStay] = useState<number | null>(null); // Min Stay (nights)
  const [maxStay, setMaxStay] = useState<number | null>(null); // Max Stay (nights)
  const [derivePricing, setDerivePricing] = useState(false); // Derive pricing from base rates
  const [selectedRatePlans, setSelectedRatePlans] = useState<string[]>([]); // Selected rate plans to apply overrides to
  const [baseRates, setBaseRates] = useState<Array<{
    id: string;
    property_id: string;
    room_type_id: string;
    base_price: number;
    start_date: string;
    end_date: string | null;
    day_prices?: Record<string, number>;
    applied_days?: string[];
    is_active: boolean;
  }>>([]); // Base rates from base_rates table

  // Load room types and rooms from Supabase based on propertyId
  useEffect(() => {
    const loadPropertyData = async () => {
      try {
        console.log('[Availability Page] Starting loadPropertyData, isLoadingAuth:', isLoadingAuth, 'propertyId:', propertyId);
        
        if (isLoadingAuth) {
          console.log('[Availability Page] Auth is still loading, returning early');
          return;
        }

        if (!propertyId) {
          console.log('[Availability Page] Property ID not found');
          addToast('Property ID not found', 'error');
          setIsLoading(false);
          return;
        }

        // Fetch room types from API
        console.log('[Availability Page] Fetching room types...');
        const roomTypesResponse = await fetch(
          `/api/property-settings/rates-availability/room-types?propertyId=${propertyId}`
        );
        
        if (!roomTypesResponse.ok) {
          throw new Error('Failed to fetch room types');
        }
        
        const { data: fetchedRoomTypes } = await roomTypesResponse.json();
        console.log('[Availability Page] Fetched room types:', fetchedRoomTypes?.length || 0);
        
        // Fetch room-type-level restrictions from API endpoint (uses server-side query with service role)
        console.log('[Availability Page] Now fetching restrictions from API...');
        try {
          const restrictionsResponse = await fetch(
            `/api/property-settings/rates-availability/restrictions?propertyId=${propertyId}`
          );
          
          console.log('[Availability Page] Restrictions API response status:', restrictionsResponse.status);
          
          if (!restrictionsResponse.ok) {
            let errorBody: any = {};
            try {
              errorBody = await restrictionsResponse.json();
            } catch {
              errorBody = { text: await restrictionsResponse.text() };
            }
            console.error('[Availability Page] Restrictions API error:', {
              status: restrictionsResponse.status,
              statusText: restrictionsResponse.statusText,
              body: errorBody,
            });
            throw new Error(`Failed to fetch restrictions (${restrictionsResponse.status}): ${errorBody?.message || errorBody?.error || 'Unknown error'}`);
          }
          
          const responseData = await restrictionsResponse.json();
          console.log('[Availability Page] Restrictions API response:', responseData);
          
          const restrictions = responseData.data || [];
          
          console.log('[Availability Page] Restrictions fetch result:', {
            restrictionsCount: restrictions?.length || 0,
            restrictions: restrictions?.slice(0, 3),
          });
          
          // Merge restrictions into room types - store all restrictions with their date ranges
          const enrichedRoomTypes = (fetchedRoomTypes || []).map((rt: any) => {
            const rtRestrictions = (restrictions || []).filter((r: any) => r.room_type_id === rt.id);
            
            // Get the first restriction record for this room type (for backward compatibility)
            const firstRestriction = rtRestrictions[0];
            const enriched = {
              ...rt,
              minStay: firstRestriction?.min_nights,
              maxStay: firstRestriction?.max_nights,
              restrictions: rtRestrictions.map((r: any) => ({
                date: r.date,
                end_date: r.end_date,
                min_nights: r.min_nights,
                max_nights: r.max_nights,
                close_to_arrival: r.close_to_arrival,
                close_to_departure: r.close_to_departure,
                override_type: r.override_type,
                override_value: r.override_value,
              })),
            };
            
            if (rtRestrictions.length > 0) {
              console.log(`[Availability Page] Room Type "${rt.name}": ${rtRestrictions.length} restrictions found`, 
                enriched.restrictions);
            }
            return enriched;
          });
          
          console.log('[Availability Page] Enriched room types:', enrichedRoomTypes.map((rt: any) => ({ 
            id: rt.id, 
            name: rt.name, 
            minStay: rt.minStay, 
            maxStay: rt.maxStay 
          })));
          
          setRoomTypes(enrichedRoomTypes);
        } catch (error) {
          console.error('[Availability Page] Error fetching room type restrictions:', error);
          addToast('Failed to fetch restrictions', 'error');
          // Still show room types even if restrictions fail to load
          setRoomTypes(fetchedRoomTypes || []);
        }

        // Fetch rooms from API
        console.log('[Availability Page] Fetching rooms...');
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
        setExpandedRoomTypes(new Set()); // All collapsed by default

        // Fetch rate plans directly from Supabase (ALL rate plans, not just default)
        try {
          const { data: plans, error: plansError } = await supabase
            .from('rate_plans')
            .select('id, room_type_id, base_price, is_default, plan_name')
            .eq('property_id', propertyId)
            .order('is_default', { ascending: false })
            .order('plan_name', { ascending: true });
          
          if (plansError) {
            console.error('Error fetching rate plans:', plansError);
            setRatePlans([]);
          } else {
            // Transform to match the component interface
            const transformedPlans = (plans || []).map((p: any) => ({
              id: p.id,
              planName: p.plan_name,
              roomTypeId: p.room_type_id,
              basePrice: p.base_price,
              default: p.is_default,
            }));
            setRatePlans(transformedPlans);
          }
        } catch (error) {
          console.error('Error fetching rate plans:', error);
          setRatePlans([]);
        }

        // Fetch base rates for the property
        try {
          const baseRatesResponse = await fetch(`/api/pricing/base-rates?propertyId=${propertyId}`);
          if (baseRatesResponse.ok) {
            const baseRatesData = await baseRatesResponse.json();
            setBaseRates(baseRatesData.baseRates || []);
          }
        } catch (error) {
          console.error('Error fetching base rates:', error);
          setBaseRates([]);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load property data:', error);
        addToast('Failed to load property data. Please try again.', 'error');
        setIsLoading(false);
      }
    };

    loadPropertyData();
  }, [propertyId, isLoadingAuth, addToast, refreshTrigger]);

  // Reset all form state when settings panel closes
  useEffect(() => {
    if (!showSettingsPanel) {
      // Reset form state
      setDateRange({ start: null, end: null });
      setOpenEnded(true);
      setSelectedDays([]);
      setSelectAllDays(true);
      setSelectedChannels(['all']);
      
      // Reset availability
      setSelectedAvailability([]);
      
      // Reset restrictions
      setCloseToArrival(false);
      setCloseToDeparture(false);
      setMinStay(null);
      setMaxStay(null);
      
      // Reset rates
      setRateOverrideType('none');
      setRateOverrideValue(0);
      setDerivePricing(false);
      setSelectedRatePlans([]);
      
      // Reset tab selection
      setSelectedSettingTab(null);
    }
  }, [showSettingsPanel]);

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

  const handleStartDateChange = (date: Date) => {
    if (!isNaN(date.getTime())) {
      setStartDate(date);
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
    setRateOverrideType('none');
    setRateOverrideValue(0);
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
    // Check if a tab is selected - if not, this shouldn't happen from calendar
    if (!selectedSettingTab) {
      addToast('No update type selected', 'info');
      return;
    }

    // Auto-correct selectAllRooms based on actual room selection
    const allAvailableRooms = Object.values(rooms).flat();
    const actuallySelectingAllRooms = 
      selectedRooms.length > 0 && 
      selectedRooms.length === allAvailableRooms.length &&
      selectedRooms.every(roomId => 
        allAvailableRooms.some(r => r.id === roomId)
      );
    
    // Use corrected selectAllRooms value for this update
    const correctedSelectAllRooms = actuallySelectingAllRooms ? true : (selectAllRooms && selectedRooms.length === 0);
    
    // Update state for next time (but use corrected value for this operation)
    if (selectAllRooms && !actuallySelectingAllRooms) {
      setSelectAllRooms(false);
    } else if (!selectAllRooms && actuallySelectingAllRooms && selectedRooms.length > 0) {
      setSelectAllRooms(true);
    }

    // Validate date range for all update types
    if (!dateRange.start) {
      addToast('Please select a start date', 'info');
      return;
    }
    if (!openEnded && !dateRange.end) {
      addToast('Please select an end date or enable "Open-ended"', 'info');
      return;
    }

    // Validate rate plan selection for rates tab
    if (selectedSettingTab === 'rates' && selectedRatePlans.length === 0) {
      addToast('Please select at least one rate plan', 'info');
      return;
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
      
      // Special handling for rates tab: use rooms from selected rate plans' room types
      if (selectedSettingTab === 'rates' && selectedRatePlans.length > 0) {
        const roomTypeIds = new Set<string>();
        selectedRatePlans.forEach(planId => {
          const plan = ratePlans.find(p => p.id === planId);
          if (plan) {
            roomTypeIds.add(plan.roomTypeId);
          }
        });
        
        // Get all rooms that belong to the selected room types
        const roomsFromSelectedTypes = Array.from(roomTypeIds).flatMap(rtId => 
          rooms[rtId] ? rooms[rtId].map(r => r.id) : []
        );
        roomsToUpdate = roomsFromSelectedTypes.length > 0 ? roomsFromSelectedTypes : Object.values(rooms).flat().map(r => r.id);
      } else {
        // Use corrected room selection logic for other tabs
        const correctedEffectiveRooms = correctedSelectAllRooms ? Object.values(rooms).flat().map(r => r.id) : selectedRooms;
        roomsToUpdate = correctedEffectiveRooms.length > 0 ? correctedEffectiveRooms : selectedRooms;
      }
    } else {
      addToast('Please select a date range and rooms', 'info');
      return;
    }

    // 🔄 AUTO-DETECT: Apply days-of-week filter if specific days selected
    // This only applies when using date range picker (not manual cell selection)
    let appliedDays: { dayIndices: number[]; displayText: string } | undefined;
    
    if (selectedCells.size === 0 && selectedDays.length > 0 && selectedDays.length < 7) {
      // Filter dates to only include selected days-of-week
      datesToUpdate = datesToUpdate.filter(idx => {
        const dayOfWeek = dates[idx].getDay();
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0-6 (Mon-Sun)
        return selectedDays.includes(dayIndex);
      });
      
      // Create display text for applied days
      const DAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      const dayLabels = selectedDays.sort((a, b) => a - b).map(idx => DAYS_SHORT[idx]);
      appliedDays = {
        dayIndices: selectedDays.sort((a, b) => a - b),
        displayText: dayLabels.join(', '),
      };
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

    // ✅ FIX: Convert date indices to actual date strings using local timezone
    const selectedDateStrings = datesToUpdate.map(idx => {
      const d = dates[idx];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    // Calculate room-by-room date ranges - SHOW USER'S SELECTED DATE RANGE, NOT FILTERED DATES
    const roomDateRanges: Record<string, string[]> = {};
    
    // Helper to format date as DD/MM/YYYY from YYYY-MM-DD string
    const formatDateString = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    // Build display ranges using USER'S SELECTED DATE RANGE (not the filtered dates)
    const dateRanges: string[] = [];
    
    if (dateRange.start) {
      // Format the start date
      const startDateStr = `${dateRange.start.getFullYear()}-${String(dateRange.start.getMonth() + 1).padStart(2, '0')}-${String(dateRange.start.getDate()).padStart(2, '0')}`;
      const startStr = formatDateString(startDateStr);
      
      if (openEnded) {
        // Open-ended: show start date to five years
        dateRanges.push(`${startStr} - Open-ended (Five years)`);
      } else if (dateRange.end) {
        // Date range: show start to end date
        const endDateStr = `${dateRange.end.getFullYear()}-${String(dateRange.end.getMonth() + 1).padStart(2, '0')}-${String(dateRange.end.getDate()).padStart(2, '0')}`;
        const endStr = formatDateString(endDateStr);
        dateRanges.push(`${startStr}-${endStr}`);
      } else {
        // Only start date specified
        dateRanges.push(startStr);
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

    // Build update data based on which tab is selected
    let updateData: any = {
      totalCells,
      uniqueRooms: roomsToUpdate.length,
      uniqueDates: datesToUpdate.length,
      roomsList,
      datesList,
      roomDateRanges: Object.keys(readableRoomDateRanges).length > 0 ? readableRoomDateRanges : undefined,
      updateType: selectedSettingTab,
      appliedDays, // Include days-of-week info for display and OTA sync
      _internalData: {
        roomsToUpdate,
        selectedDateStrings,
        appliedDays, // Store for API persistence
        dateRangeStart: dateRange.start ? `${dateRange.start.getFullYear()}-${String(dateRange.start.getMonth() + 1).padStart(2, '0')}-${String(dateRange.start.getDate()).padStart(2, '0')}` : null,
        dateRangeEnd: dateRange.end ? `${dateRange.end.getFullYear()}-${String(dateRange.end.getMonth() + 1).padStart(2, '0')}-${String(dateRange.end.getDate()).padStart(2, '0')}` : null,
        openEnded,
      },
    };

    if (selectedSettingTab === 'availability') {
      // AVAILABILITY UPDATE
      const selectedAvailOpt = AVAILABILITY_OPTIONS.find(opt => opt.id === selectedAvailability[0]);
      const availabilityLabel = selectedAvailOpt?.label || 'Unknown';
      const availabilityColor = selectedAvailOpt?.color || '#000000';
      const databaseStatus = mapAvailabilityIdToStatus(selectedAvailability[0]);

      updateData = {
        ...updateData,
        availabilityLabel,
        availabilityColor,
        stopSellReason: selectedAvailability.includes('stop_sell') ? stopSellReason : undefined,
        _internalData: {
          ...updateData._internalData,
          status: databaseStatus,
          stopSellReason: selectedAvailability.includes('stop_sell') ? stopSellReason : null,
          minNights: selectedAvailability.includes('min_stay') ? parseInt(minStayNights) || 1 : 1,
          maxNights: selectedAvailability.includes('max_stay') ? parseInt(maxStayNights) || null : null,
        },
      };
    } else if (selectedSettingTab === 'restrictions') {
      // RESTRICTIONS UPDATE
      // Get room type names for selected rooms
      const selectedRoomTypeNames: string[] = [];
      selectedRooms.forEach(roomId => {
        const roomType = roomTypes.find(rt => 
          rooms[rt.id]?.some(room => room.id === roomId)
        );
        if (roomType && !selectedRoomTypeNames.includes(roomType.name)) {
          selectedRoomTypeNames.push(roomType.name);
        }
      });

      updateData = {
        ...updateData,
        restrictionLabel: 'Room Restrictions',
        restrictionTypes: [],
        restrictionRoomTypes: selectedRoomTypeNames,
        _internalData: {
          ...updateData._internalData,
          minStay,
          maxStay,
          closeToArrival,
          closeToDeparture,
        },
      };

      // Build restriction types list for preview
      if (minStay !== null && minStay > 0) updateData.restrictionTypes.push(`Min Stay: ${minStay} night(s)`);
      if (maxStay !== null && maxStay > 0) updateData.restrictionTypes.push(`Max Stay: ${maxStay} night(s)`);
      if (closeToArrival) updateData.restrictionTypes.push('Close to Arrival');
      if (closeToDeparture) updateData.restrictionTypes.push('Close to Departure');
    } else if (selectedSettingTab === 'rates') {
      // RATES UPDATE
      // Group rate plans by room type
      const ratesByRoomType: Record<string, { ratePlans: string[]; rateOverride: string }> = {};
      
      selectedRatePlans.forEach(planId => {
        const plan = ratePlans.find(p => p.id === planId);
        if (plan) {
          const roomType = roomTypes.find(rt => rt.id === plan.roomTypeId);
          if (roomType) {
            if (!ratesByRoomType[roomType.name]) {
              ratesByRoomType[roomType.name] = {
                ratePlans: [],
                rateOverride: '',
              };
            }
            ratesByRoomType[roomType.name].ratePlans.push(plan.name);
          }
        }
      });

      // Build rate override description
      let rateOverrideDesc = '';
      if (rateOverrideType !== 'none') {
        rateOverrideDesc = rateOverrideType === 'percentage' 
          ? `${rateOverrideValue > 0 ? '+' : ''}${rateOverrideValue}%` 
          : `$${rateOverrideValue}`;
      }

      // Add rate override to all room types
      Object.entries(ratesByRoomType).forEach(([roomTypeName]) => {
        if (rateOverrideDesc) {
          ratesByRoomType[roomTypeName].rateOverride = `Override: ${rateOverrideDesc}`;
          if (derivePricing) {
            ratesByRoomType[roomTypeName].rateOverride += ' (with Derive Pricing)';
          }
        } else if (derivePricing) {
          ratesByRoomType[roomTypeName].rateOverride = 'Derive Pricing: Yes';
        }
      });

      updateData = {
        ...updateData,
        ratesLabel: 'Rate Override',
        rateDetails: [],
        ratesByRoomType,
        _internalData: {
          ...updateData._internalData,
          rateOverrideType,
          rateOverrideValue,
          selectedRatePlans,
          derivePricing,
        },
      };

      // Build rate details for preview (summary)
      if (rateOverrideType !== 'none') {
        updateData.rateDetails.push(`Type: ${rateOverrideType === 'percentage' ? 'Percentage' : 'Fixed Price'}`);
        updateData.rateDetails.push(`Value: ${rateOverrideType === 'percentage' ? `${rateOverrideValue}%` : `$${rateOverrideValue}`}`);
      }
      if (derivePricing) updateData.rateDetails.push('Derive Pricing: Yes');
      updateData.rateDetails.push(`Rate Plans: ${selectedRatePlans.length}`);
    }

    setPendingUpdate(updateData);
    setShowPreviewModal(true);
  };

  const confirmUpdate = async () => {
    setIsSubmitting(true);
    try {
      if (!pendingUpdate?._internalData || !propertyId) {
        throw new Error('Missing update data');
      }

      const updateType = pendingUpdate.updateType || 'availability';
      const { roomsToUpdate, selectedDateStrings, appliedDays, dateRangeStart, dateRangeEnd, openEnded: openEndedUpdate } = pendingUpdate._internalData;

      console.log('[confirmUpdate] updateType:', updateType);
      console.log('[confirmUpdate] roomsToUpdate:', roomsToUpdate);
      console.log('[confirmUpdate] appliedDays:', appliedDays);

      // ✅ FIX: When appliedDays is set, use the ORIGINAL date range (not the filtered dates)
      // This creates ONE record with applied_days instead of multiple records
      const datesToUse = appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7
        ? [] // Will handle separately below
        : selectedDateStrings;

      // ✅ FIX: Convert date strings to Date objects using local timezone (parse YYYY-MM-DD)
      const selectedDates = datesToUse
        .map((dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        })
        .sort((a, b) => a.getTime() - b.getTime());

      // ✅ FIX: Format effective end date without timezone conversion
      const effectiveEndDate = openEndedUpdate ? getFiveYearEndDate() : selectedDateStrings[selectedDateStrings.length - 1];

      // ============ AVAILABILITY UPDATE ============
      if (updateType === 'availability') {
        const { status, stopSellReason: stopSellReasonFromUpdate, minNights, maxNights } = pendingUpdate._internalData;
        
        console.log('[confirmUpdate] Availability update - status:', status, 'selectedAvailability:', selectedAvailability);
        
        // Check if this is a room-type-level restriction (Min Stay, Max Stay, CTA, or CTD)
        const isRoomTypeLevelRestriction = 
          selectedAvailability.includes('min_stay') || 
          selectedAvailability.includes('max_stay') ||
          selectedAvailability.includes('close_arrival') ||
          selectedAvailability.includes('close_departure');
        
        // For room type restrictions, convert room IDs to room type IDs
        let targetIds = roomsToUpdate;
        if (isRoomTypeLevelRestriction) {
          const roomTypeIds = new Set<string>();
          roomsToUpdate.forEach(roomId => {
            for (const [roomTypeId, roomsInType] of Object.entries(rooms)) {
              const found = roomsInType.some(r => r.id === roomId);
              if (found) {
                roomTypeIds.add(roomTypeId);
                break;
              }
            }
          });
          targetIds = Array.from(roomTypeIds);
        }
        
        const availabilities = [];
        
        for (const targetId of targetIds) {
          // ✅ NEW: When appliedDays is set, create ONE record for the full date range
          if (appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7) {
            // Use the original date range (not filtered dates)
            const startDateStr = dateRangeStart;
            const endDateStr = dateRangeEnd || dateRangeStart;

            const availObj: any = {
              date: startDateStr,
              status: status,
              occupancy: 1,
            };

            if (isRoomTypeLevelRestriction) {
              availObj.roomTypeId = targetId;
              availObj.appliedAtLevel = 'room_type';
            } else {
              availObj.roomId = targetId;
              availObj.appliedAtLevel = 'room';
            }

            if (endDateStr && endDateStr !== startDateStr) {
              availObj.endDate = endDateStr;
            }

            // Store applied days for OTA sync
            availObj.appliedDays = appliedDays.dayIndices;
            availObj.appliedDaysText = appliedDays.displayText;

            if (selectedAvailability.includes('min_stay') && minNights !== undefined && minNights > 0) {
              availObj.minNights = minNights;
            }
            if (selectedAvailability.includes('max_stay') && maxNights !== undefined && maxNights > 0) {
              availObj.maxNights = maxNights;
            }
            if (selectedAvailability.includes('close_arrival')) {
              availObj.closeToArrival = true;
            }
            if (selectedAvailability.includes('close_departure')) {
              availObj.closeToDeparture = true;
            }
            if (selectedAvailability.includes('stop_sell')) {
              if (stopSellReasonFromUpdate) {
                availObj.notes = stopSellReasonFromUpdate;
              }
            }

            availabilities.push(availObj);
            console.log('[confirmUpdate] Created single availability record with applied_days:', {
              date: startDateStr,
              endDate: endDateStr,
              appliedDays: appliedDays.displayText,
            });
          } else {
            // ✅ ORIGINAL: Multiple records when NO appliedDays filter
            const dateRanges: Array<{ startIdx: number; endIdx: number }> = [];
          
          if (selectedDates.length > 0) {
            let rangeStart = 0;
            let rangeEnd = 0;
            
            for (let i = 1; i < selectedDates.length; i++) {
              const dayDiff = (selectedDates[i].getTime() - selectedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
              if (Math.abs(dayDiff - 1) < 0.1) {
                rangeEnd = i;
              } else {
                dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
                rangeStart = i;
                rangeEnd = i;
              }
            }
            dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
          }
          
          for (const range of dateRanges) {
            const startDate = selectedDates[range.startIdx];
            const endDate = selectedDates[range.endIdx];
            // ✅ FIX: Use local timezone format instead of UTC to avoid one-day shift
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            // Use the actual status from _internalData, not hardcoded 'available'
            const availObj: any = {
              date: startDateStr,
              status: status,  // FIX: Use status from _internalData (e.g., 'not_available' for stop_sell)
              occupancy: 1,
            };

            if (isRoomTypeLevelRestriction) {
              availObj.roomTypeId = targetId;
              availObj.appliedAtLevel = 'room_type';
            } else {
              availObj.roomId = targetId;
              availObj.appliedAtLevel = 'room';
            }

            if (range.endIdx > range.startIdx || effectiveEndDate) {
              availObj.endDate = effectiveEndDate || endDateStr;
            }
            
            // Store applied days for OTA sync and audit trail
            if (appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7) {
              availObj.appliedDays = appliedDays.dayIndices; // Store as [0,1,2,3,4] for Mon-Fri, etc.
              availObj.appliedDaysText = appliedDays.displayText; // Store for reference (Mo, Tu, We...)
            }
            
            if (selectedAvailability.includes('min_stay') && minNights !== undefined && minNights > 0) {
              availObj.minNights = minNights;
            }
            if (selectedAvailability.includes('max_stay') && maxNights !== undefined && maxNights > 0) {
              availObj.maxNights = maxNights;
            }
            if (selectedAvailability.includes('close_arrival')) {
              availObj.closeToArrival = true;
            }
            if (selectedAvailability.includes('close_departure')) {
              availObj.closeToDeparture = true;
            }
            // For stop_sell, always include the notes (reason) if available
            if (selectedAvailability.includes('stop_sell')) {
              if (stopSellReasonFromUpdate) {
                availObj.notes = stopSellReasonFromUpdate;
              }
              console.log('[confirmUpdate] Stop sell record:', {
                roomId: availObj.roomId || availObj.roomTypeId,
                date: startDateStr,
                status: availObj.status,
                notes: availObj.notes,
              });
            }
            if (rateOverrideType !== 'none' && rateOverrideValue > 0) {
              availObj.rateOverrideType = rateOverrideType;
              availObj.rateOverrideValue = rateOverrideValue;
            }

            availabilities.push(availObj);
          }
          } // Close else block for appliedDays check
        }

        // Send availability updates
        console.log('[confirmUpdate] Sending', availabilities.length, 'availability updates');
        const BATCH_SIZE = 150;
        const batches = [];
        
        for (let i = 0; i < availabilities.length; i += BATCH_SIZE) {
          batches.push(availabilities.slice(i, i + BATCH_SIZE));
        }
        
        let totalRecordsUpserted = 0;
        
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          
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
            const details = errorData.details ? `: ${errorData.details}` : '';
            throw new Error((errorData.error || `Batch ${batchIdx + 1} failed (HTTP ${response.status})`) + details);
          }

          const result = await response.json();
          totalRecordsUpserted += result.data?.recordsUpserted || 0;
        }

        addToast(`✅ Successfully updated ${totalRecordsUpserted} availability records!`, 'success');
      } 
      // ============ RESTRICTIONS UPDATE ============
      else if (updateType === 'restrictions') {
        const { minStay, maxStay, closeToArrival, closeToDeparture } = pendingUpdate._internalData;

        console.log('[confirmUpdate] Processing restrictions update');
        console.log('[confirmUpdate] minStay:', minStay, 'maxStay:', maxStay, 'CTA:', closeToArrival, 'CTD:', closeToDeparture);

        // Convert room IDs to room type IDs - one restriction per room type
        const roomTypeIds = new Set<string>();
        console.log('[confirmUpdate] Starting room-to-roomType mapping...');
        console.log('[confirmUpdate] roomsToUpdate:', roomsToUpdate);
        console.log('[confirmUpdate] rooms object keys:', Object.keys(rooms));
        console.log('[confirmUpdate] rooms object structure:', rooms);
        
        roomsToUpdate.forEach(roomId => {
          console.log('[confirmUpdate] Looking for room:', roomId);
          for (const [roomTypeId, roomsInType] of Object.entries(rooms)) {
            console.log(`  Checking room type ${roomTypeId} with ${roomsInType.length} rooms`);
            const found = roomsInType.some(r => r.id === roomId);
            if (found) {
              console.log(`  ✓ Found room ${roomId} in room type ${roomTypeId}`);
              roomTypeIds.add(roomTypeId);
              break;
            }
          }
        });

        console.log('[confirmUpdate] Room Type IDs extracted:', Array.from(roomTypeIds));
        console.log('[confirmUpdate] Available room types in rooms object:', Object.keys(rooms));

        if (roomTypeIds.size === 0) {
          throw new Error(`No room types found for selected rooms. Selected rooms: ${roomsToUpdate.join(', ')}. Available room types: ${Object.keys(rooms).join(', ')}`);
        }

        const restrictions = [];
        
        for (const roomTypeId of Array.from(roomTypeIds)) {
          // ✅ NEW: When appliedDays is set, create ONE record for the full date range
          if (appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7) {
            // Use the original date range (not filtered dates)
            const startDateStr = dateRangeStart;
            const endDateStr = dateRangeEnd || dateRangeStart;

            const restrictionObj: any = {
              roomTypeId,
              date: startDateStr,
            };

            if (endDateStr && endDateStr !== startDateStr) {
              restrictionObj.endDate = endDateStr;
            }

            // Store applied days for OTA sync
            restrictionObj.appliedDays = appliedDays.dayIndices;
            restrictionObj.appliedDaysText = appliedDays.displayText;

            if (minStay !== null && minStay > 0) {
              restrictionObj.minStay = minStay;
            }
            if (maxStay !== null && maxStay > 0) {
              restrictionObj.maxStay = maxStay;
            }
            if (closeToArrival) {
              restrictionObj.closeToArrival = true;
            }
            if (closeToDeparture) {
              restrictionObj.closeToDeparture = true;
            }

            restrictions.push(restrictionObj);
            console.log('[confirmUpdate] Created single restriction record with applied_days:', {
              date: startDateStr,
              endDate: endDateStr,
              appliedDays: appliedDays.displayText,
            });
          } else {
            // ✅ ORIGINAL: Multiple records when NO appliedDays filter
            const dateRanges: Array<{ startIdx: number; endIdx: number }> = [];
          
          if (selectedDates.length > 0) {
            let rangeStart = 0;
            let rangeEnd = 0;
            
            for (let i = 1; i < selectedDates.length; i++) {
              const dayDiff = (selectedDates[i].getTime() - selectedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
              if (Math.abs(dayDiff - 1) < 0.1) {
                rangeEnd = i;
              } else {
                dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
                rangeStart = i;
                rangeEnd = i;
              }
            }
            dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
          }
          
          for (const range of dateRanges) {
            const startDate = selectedDates[range.startIdx];
            const endDate = selectedDates[range.endIdx];
            // ✅ FIX: Use local timezone format instead of UTC to avoid one-day shift
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            const restrictionObj: any = {
              roomTypeId,
              date: startDateStr,
            };

            if (range.endIdx > range.startIdx || effectiveEndDate) {
              restrictionObj.endDate = effectiveEndDate || endDateStr;
            }
            
            // Store applied days for OTA sync and audit trail
            if (appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7) {
              restrictionObj.appliedDays = appliedDays.dayIndices;
              restrictionObj.appliedDaysText = appliedDays.displayText;
            }
            
            if (minStay !== null && minStay > 0) {
              restrictionObj.minStay = minStay;
            }
            if (maxStay !== null && maxStay > 0) {
              restrictionObj.maxStay = maxStay;
            }
            if (closeToArrival) {
              restrictionObj.closeToArrival = true;
            }
            if (closeToDeparture) {
              restrictionObj.closeToDeparture = true;
            }

            restrictions.push(restrictionObj);
          }
          } // Close else block for appliedDays check
        }

        // Send restrictions updates
        console.log('[confirmUpdate] Sending', restrictions.length, 'restriction updates');
        console.log('[confirmUpdate] Restriction objects:', JSON.stringify(restrictions.slice(0, 2), null, 2));
        const BATCH_SIZE = 150;
        const batches = [];
        
        for (let i = 0; i < restrictions.length; i += BATCH_SIZE) {
          batches.push(restrictions.slice(i, i + BATCH_SIZE));
        }
        
        let totalRecordsUpserted = 0;
        
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          
          const response = await fetch('/api/property-settings/rates-availability/restrictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              propertyId,
              restrictions: batch,
            }),
          });

          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: `HTTP ${response.status}` };
            }
            console.error('[confirmUpdate] API Error Response:', JSON.stringify(errorData, null, 2));
            console.error('[confirmUpdate] Full error data:', errorData);
            if (errorData.data?.errors) {
              console.error('[confirmUpdate] Detailed errors:', JSON.stringify(errorData.data.errors, null, 2));
            }
            console.error('[confirmUpdate] Request payload:', { propertyId, restrictionCount: batch.length, sample: batch[0] });
            throw new Error(errorData.error || errorData.details || `Batch ${batchIdx + 1} failed (HTTP ${response.status})`);
          }

          const result = await response.json();
          totalRecordsUpserted += result.data?.recordsUpserted || 0;
        }

        addToast(`✅ Successfully updated ${totalRecordsUpserted} restriction records!`, 'success');
      }
      // ============ RATES UPDATE ============
      else if (updateType === 'rates') {
        const { rateOverrideType: rateType, rateOverrideValue: rateValue, selectedRatePlans: selectedPlanIds, derivePricing } = pendingUpdate._internalData;

        console.log('[confirmUpdate] Processing rates update');
        console.log('[confirmUpdate] rateType:', rateType, 'rateValue:', rateValue, 'selectedRatePlans:', selectedPlanIds, 'derivePricing:', derivePricing);

        const rates = [];
        
        // Loop through selected rate plans (not rooms) - one record per rate plan per date range
        for (const ratePlanId of (selectedPlanIds || [])) {
          // Find the rate plan object from the ratePlans state
          const ratePlan = ratePlans.find((p: any) => p.id === ratePlanId);
          
          if (!ratePlan) {
            console.warn('[confirmUpdate] Rate plan not found:', ratePlanId);
            continue;
          }

          const roomTypeId = ratePlan.roomTypeId;
          
          if (!roomTypeId) {
            console.warn('[confirmUpdate] Room type ID not found for rate plan:', ratePlanId, ratePlan);
            continue;
          }

          console.log(`[confirmUpdate] Processing rate plan ${ratePlanId} for room type ${roomTypeId}`);

          // ✅ NEW: When appliedDays is set, create ONE record for the full date range
          if (appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7) {
            // Use the original date range (not filtered dates)
            const startDateStr = dateRangeStart;
            const endDateStr = dateRangeEnd || dateRangeStart;

            const rateObj: any = {
              roomTypeId,
              ratePlanId,
              date: startDateStr,
            };

            if (endDateStr && endDateStr !== startDateStr) {
              rateObj.endDate = endDateStr;
            }

            // Store applied days for OTA sync
            rateObj.appliedDays = appliedDays.dayIndices;
            rateObj.appliedDaysText = appliedDays.displayText;

            if (rateType !== 'none') {
              rateObj.overrideType = rateType;
              rateObj.overrideValue = rateValue;
            }

            if (derivePricing) {
              rateObj.derivePricing = true;
            }

            rates.push(rateObj);
            console.log('[confirmUpdate] Created single rate record with applied_days:', {
              date: startDateStr,
              endDate: endDateStr,
              appliedDays: appliedDays.displayText,
            });
          } else {
            // ✅ ORIGINAL: Multiple records when NO appliedDays filter
            const dateRanges: Array<{ startIdx: number; endIdx: number }> = [];
          
          if (selectedDates.length > 0) {
            let rangeStart = 0;
            let rangeEnd = 0;
            
            for (let i = 1; i < selectedDates.length; i++) {
              const dayDiff = (selectedDates[i].getTime() - selectedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
              if (Math.abs(dayDiff - 1) < 0.1) {
                rangeEnd = i;
              } else {
                dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
                rangeStart = i;
                rangeEnd = i;
              }
            }
            dateRanges.push({ startIdx: rangeStart, endIdx: rangeEnd });
          }
          
          for (const range of dateRanges) {
            const startDate = selectedDates[range.startIdx];
            const endDate = selectedDates[range.endIdx];
            // ✅ FIX: Use local timezone format instead of UTC to avoid one-day shift
            const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            // Create one record per rate plan per date range (room type level)
            const rateObj: any = {
              roomTypeId,  // ✅ CHANGED: Use room type ID instead of room ID
              ratePlanId,  // ✅ NEW: Include the specific rate plan ID
              date: startDateStr,
            };

            if (range.endIdx > range.startIdx || effectiveEndDate) {
              rateObj.endDate = effectiveEndDate || endDateStr;
            }
            
            // Store applied days for OTA sync and audit trail
            if (appliedDays && appliedDays.dayIndices && appliedDays.dayIndices.length > 0 && appliedDays.dayIndices.length < 7) {
              rateObj.appliedDays = appliedDays.dayIndices;
              rateObj.appliedDaysText = appliedDays.displayText;
            }
            
            if (rateType !== 'none') {
              rateObj.overrideType = rateType;
              rateObj.overrideValue = rateValue;
            }
            
            if (derivePricing) {
              rateObj.derivePricing = true;
            }

            rates.push(rateObj);
          }
          } // Close else block for appliedDays check
        }

        console.log('[confirmUpdate] Created', rates.length, 'rate override records (one per rate plan per date range)');
        console.log('[confirmUpdate] Sample rate record:', rates[0]);

        // Send rates updates
        console.log('[confirmUpdate] Sending', rates.length, 'rate override updates');
        const BATCH_SIZE = 150;
        const batches = [];
        
        for (let i = 0; i < rates.length; i += BATCH_SIZE) {
          batches.push(rates.slice(i, i + BATCH_SIZE));
        }
        
        let totalRecordsUpserted = 0;
        
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          
          const response = await fetch('/api/property-settings/rates-availability/rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              propertyId,
              rates: batch,
            }),
          });

          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: `HTTP ${response.status}` };
            }
            throw new Error(errorData.error || `Batch ${batchIdx + 1} failed (HTTP ${response.status})`);
          }

          const result = await response.json();
          totalRecordsUpserted += result.data?.recordsUpserted || 0;
        }

        addToast(`✅ Successfully updated ${totalRecordsUpserted} rate override records!`, 'success');
      }
      
      setShowPreviewModal(false);
      setPendingUpdate(null);
      setSelectedCells(new Map());
      
      // Reset all form state for next update
      setSelectedAvailability([]);
      setStopSellReason('');
      setSelectedDays([]);
      setSelectAllDays(true);
      setDateRange({ start: null, end: null });
      setSelectedRoomType('all');
      setSelectedRooms([]);
      setSelectAllRooms(true);
      setMinStayNights('');
      setMaxStayNights('');
      setRateOverrideType('none');
      setRateOverrideValue(0);
      setDerivePricing(false);
      setSelectedRatePlans([]);
      setCloseToArrival(false);
      setCloseToDeparture(false);
      setMinStay(null);
      setMaxStay(null);
      setOpenEnded(true);
      
      // Trigger calendar refresh
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Update failed:', error);
      addToast(
        `Failed to update: ${(error as Error).message}`,
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
                ratePlans={ratePlans}
                baseRates={baseRates}
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
                onSettingsOpenChange={setShowSettingsPanel}
                onSettingsTabChange={setSelectedSettingTab}
                selectedSettingTab={selectedSettingTab}
                showSettingsPanel={showSettingsPanel}
                settingsPanel={(
                  <>
                    {selectedSettingTab === 'availability' && (
                      <AvailabilitySettingsForm
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
                        selectedAvailability={selectedAvailability}
                        onSelectedAvailabilityChange={setSelectedAvailability}
                        selectedRoomType={selectedRoomType}
                        onSelectedRoomTypeChange={setSelectedRoomType}
                        roomTypes={roomTypes}
                        rooms={rooms}
                        selectedRooms={selectedRooms}
                        onSelectedRoomsChange={setSelectedRooms}
                        selectAllRooms={selectAllRooms}
                        onSelectAllRoomsChange={setSelectAllRooms}
                        onUpdate={handleUpdate}
                        onReset={handleReset}
                      />
                    )}
                    
                    {selectedSettingTab === 'restrictions' && (
                      <RestrictionsSettingsForm
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
                        closeToArrival={closeToArrival}
                        onCloseToArrivalChange={setCloseToArrival}
                        closeToDeparture={closeToDeparture}
                        onCloseToDepartureChange={setCloseToDeparture}
                        minStay={minStay}
                        onMinStayChange={setMinStay}
                        maxStay={maxStay}
                        onMaxStayChange={setMaxStay}
                        selectedRoomType={selectedRoomType}
                        onSelectedRoomTypeChange={setSelectedRoomType}
                        roomTypes={roomTypes}
                        rooms={rooms}
                        selectedRooms={selectedRooms}
                        onSelectedRoomsChange={setSelectedRooms}
                        selectAllRooms={selectAllRooms}
                        onSelectAllRoomsChange={setSelectAllRooms}
                        onUpdate={handleUpdate}
                        onReset={handleReset}
                      />
                    )}
                    
                    {selectedSettingTab === 'rates' && (
                      <RatesSettingsForm
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
                        rateOverrideType={rateOverrideType}
                        onRateOverrideTypeChange={setRateOverrideType}
                        rateOverrideValue={rateOverrideValue}
                        onRateOverrideValueChange={setRateOverrideValue}
                        derivePricing={derivePricing}
                        onDerivePricingChange={setDerivePricing}
                        roomTypes={roomTypes}
                        ratePlans={ratePlans}
                        selectedRatePlans={selectedRatePlans}
                        onSelectedRatePlansChange={setSelectedRatePlans}
                        onUpdate={handleUpdate}
                        onReset={handleReset}
                      />
                    )}
                  </>
                )}
                onStartDateChange={handleStartDateChange}
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
