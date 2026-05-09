'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, HelpCircle, ChevronLeft, ChevronRight, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { dateToString, stringToDate, expandDateRange } from '@/lib/date-utils';
import BlockBar from './block-bar';

interface Room {
  id: string;
  name: string;
}

interface RoomsObject {
  [roomTypeId: string]: Room[];
}

interface RoomType {
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
}

interface AvailabilityOption {
  id: string;
  label: string;
  color: string;
}

interface AvailabilityData {
  room_id: string;
  date: string;
  end_date: string | null;
  status: string;
  occupancy?: number;
  notes?: string | null;
  reason?: string | null;
  reason_details?: string | null;
  // Restriction fields from availability_restrictions table
  min_nights?: number | null;
  max_nights?: number | null;
  close_to_arrival?: boolean;
  close_to_departure?: boolean;
  // Rate fields from rate_overrides table
  override_type?: string | null;
  override_value?: number | null;
  derive_pricing?: boolean;
  rate_plan_ids?: string[];
}

interface BulkAvailabilityCalendarProps {
  dates: Date[];
  roomTypes: RoomType[];
  rooms: RoomsObject;
  selectedAvailability: string[];
  availabilityOptions: AvailabilityOption[];
  selectedRoomType: string;
  propertyId?: string;
  selectedCells?: Map<string, Set<number>>;
  expandedRoomTypes?: Set<string>;
  ratePlans?: Array<{ id: string; planName?: string; roomTypeId: string; basePrice?: number; default: boolean }>;
  baseRates?: Array<{
    id: string;
    property_id: string;
    room_type_id: string;
    base_price: number;
    start_date: string;
    end_date: string | null;
    day_prices?: Record<string, number>;
    applied_days?: string[];
    is_active: boolean;
  }>;
  onToggleRoomType?: (roomTypeId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onCellClick?: (roomId: string, dateIndex: number, event: React.MouseEvent) => void;
  onCellDragStart?: (roomId: string, dateIndex: number) => void;
  onCellDragOver?: (roomId: string, dateIndex: number) => void;
  onCellDragEnd?: () => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onGoToToday?: () => void;
  onGoToNextWeek?: () => void;
  onGoToNextMonth?: () => void;
  onSettingsOpenChange?: (open: boolean) => void;
  onSettingsTabChange?: (tab: 'availability' | 'restrictions' | 'rates') => void;
  selectedSettingTab?: 'availability' | 'restrictions' | 'rates' | null;
  showSettingsPanel?: boolean;
  settingsPanel?: React.ReactNode;
  onStartDateChange?: (date: Date) => void;
  startDate?: Date;
  selectedDateRanges?: string[];
  refreshTrigger?: number;
}

const formatDateHeader = (date: Date): string => {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  return `${dayName} ${dayNum}`;
};

// Status to color mapping for database statuses
const STATUS_COLOR_MAP: Record<string, string> = {
  'available': '#10b981',        // green
  'not_available': '#ef4444',     // red (stop sell)
  'closed_to_arrival': '#f97316', // orange
  'closed_to_departure': '#8b5cf6', // purple
};

export function BulkAvailabilityCalendar({
  dates,
  roomTypes,
  rooms,
  selectedAvailability,
  availabilityOptions,
  selectedRoomType,
  propertyId,
  selectedCells = new Map(),
  expandedRoomTypes = new Set(),
  ratePlans = [],
  baseRates = [],
  onToggleRoomType,
  onExpandAll,
  onCollapseAll,
  onCellClick,
  onCellDragStart,
  onCellDragOver,
  onCellDragEnd,
  onPrevDay,
  onNextDay,
  onGoToToday,
  onGoToNextWeek,
  onGoToNextMonth,
  onSettingsOpenChange,
  onSettingsTabChange,
  selectedSettingTab = null,
  showSettingsPanel = false,
  settingsPanel,
  onStartDateChange,
  startDate,
  selectedDateRanges = [],
  refreshTrigger = 0,
}: BulkAvailabilityCalendarProps) {
  const [availabilityDataMap, setAvailabilityDataMap] = useState<Map<string, AvailabilityData>>(new Map());
  const [expandedRatePlans, setExpandedRatePlans] = useState<Set<string>>(new Set()); // Track which room types have rates expanded
  const [popoverState, setPopoverState] = useState<{ roomId: string; dateIdx: number; open: boolean } | null>(null);
  const [isUpdatingCell, setIsUpdatingCell] = useState(false);
  
  // Block management state
  const [blockPopoverState, setBlockPopoverState] = useState<{ roomId: string; roomTypeId: string; blockIndex: number; open: boolean } | null>(null);
  const [isEditingBlock, setIsEditingBlock] = useState(false);
  const [blockEditingData, setBlockEditingData] = useState<{ startDate: Date; endDate: Date } | null>(null);
  
  // Reason and notes state
  const [selectedReason, setSelectedReason] = useState<string>('stop_sell');
  const [reasonNotes, setReasonNotes] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('stop_sell');
  const [blockReasonDetails, setBlockReasonDetails] = useState<string>('');
  
  // Restriction modal state
  const [restrictionModalOpen, setRestrictionModalOpen] = useState(false);
  const [selectedRoomTypeForRestriction, setSelectedRoomTypeForRestriction] = useState<RoomType | null>(null);
  const [restrictionFormData, setRestrictionFormData] = useState({
    minNights: null as number | null,
    maxNights: null as number | null,
    closeToArrival: false,
    closeToDeparture: false,
    restrictionStartDate: dates.length > 0 ? dates[0] : new Date(),
    restrictionEndDate: dates.length > 0 ? dates[dates.length - 1] : new Date(),
  });
  const [isUpdatingRestriction, setIsUpdatingRestriction] = useState(false);

  // Rate edit modal state
  const [rateEditModalOpen, setRateEditModalOpen] = useState(false);
  const [selectedRoomTypeForRateEdit, setSelectedRoomTypeForRateEdit] = useState<RoomType | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>('');
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [editingRateDateIndex, setEditingRateDateIndex] = useState<number | null>(null);
  const [rateEditStartDate, setRateEditStartDate] = useState<Date>(new Date());
  const [rateEditEndDate, setRateEditEndDate] = useState<Date>(new Date());

  // Rate override modal state
  const [rateOverrideModalOpen, setRateOverrideModalOpen] = useState(false);
  const [selectedRatePlanForOverride, setSelectedRatePlanForOverride] = useState<any>(null);
  const [selectedDateIndexForRateOverride, setSelectedDateIndexForRateOverride] = useState<number | null>(null);
  const [overrideFormData, setOverrideFormData] = useState({
    overrideType: 'fixed' as 'fixed' | 'percentage',
    fixedPrice: '',
    percentageValue: '',
    rateOverrideStartDate: new Date(),
    rateOverrideEndDate: new Date(),
  });
  const [isUpdatingRateOverride, setIsUpdatingRateOverride] = useState(false);

  // Confirmation modal state for single cell click
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'available' | 'stop_sell' | null>(null);
  const [pendingCellData, setPendingCellData] = useState<{
    roomId: string;
    dateIdx: number;
    roomType: RoomType;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  // Popover date range state
  const [popoverDateRange, setPopoverDateRange] = useState<{ start: Date; end: Date } | null>(null);

  // Helper function to get restrictions that apply to a specific date
  const getRestrictionsForDate = (roomType: RoomType, date: Date) => {
    if (!roomType.restrictions || roomType.restrictions.length === 0) {
      return [];
    }

    // ✅ FIX: Use consistent date string format for comparison
    const dateStr = dateToString(date);
    
    return roomType.restrictions.filter(restriction => {
      const restrictionStart = restriction.date;
      const restrictionEnd = restriction.end_date;
      
      // Check if dateStr falls within the restriction date range
      // If end_date is null, restriction applies to that date and all future dates
      const isOnOrAfterStart = dateStr >= restrictionStart;
      const isOnOrBeforeEnd = !restrictionEnd || dateStr <= restrictionEnd;
      
      return isOnOrAfterStart && isOnOrBeforeEnd;
    });
  };

  // Helper function to check if any room in a room type has an override for a specific date
  const hasAnyRoomOverrideForDate = (roomTypeId: string, dateIndex: number): boolean => {
    const roomsInType = rooms[roomTypeId] || [];
    return roomsInType.some(room => {
      const rateData = getRateOverrideForRoomDate(room.id, dateIndex);
      return rateData?.override_type !== null && rateData?.override_type !== undefined;
    });
  };

  // Helper function to get the default rate for a room type (legacy rate_plans)
  const getDefaultRate = (roomTypeId: string): number | undefined => {
    const defaultRatePlan = ratePlans.find(
      (plan) => plan.roomTypeId === roomTypeId && plan.default
    );
    return defaultRatePlan?.basePrice;
  };

  // Day-of-week map used by base_rates.day_prices
  const DAY_CODE_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Find the active base rate for a room type on a given date
  const getBaseRateForDate = (roomTypeId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return baseRates.find(br =>
      br.room_type_id === roomTypeId &&
      br.is_active &&
      br.start_date <= dateStr &&
      (br.end_date === null || br.end_date >= dateStr)
    );
  };

  // Resolve the price for a room type on a specific date from base_rates
  const getBaseRatePrice = (roomTypeId: string, date: Date): number | undefined => {
    const br = getBaseRateForDate(roomTypeId, date);
    if (!br) return undefined;
    const dayCode = DAY_CODE_MAP[date.getDay()];
    // Use per-day price if available, otherwise fallback to base_price
    if (br.day_prices && br.day_prices[dayCode] != null) {
      return br.day_prices[dayCode];
    }
    return br.base_price;
  };

  // Helper function to get ALL rate plans for a room type
  const getRatePlansForRoomType = (roomTypeId: string) => {
    return ratePlans.filter((plan) => plan.roomTypeId === roomTypeId);
  };

  // Helper function to toggle rate plans expansion
  const toggleRatePlans = (roomTypeId: string) => {
    const newExpanded = new Set(expandedRatePlans);
    if (newExpanded.has(roomTypeId)) {
      newExpanded.delete(roomTypeId);
    } else {
      newExpanded.add(roomTypeId);
    }
    setExpandedRatePlans(newExpanded);
  };

  // Bulk selection helper functions
  const handleCellClick = (roomId: string, dateIdx: number, roomType: RoomType, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Store the cell data and show menu
    setPendingCellData({ roomId, dateIdx, roomType, startDate: dates[dateIdx], endDate: dates[dateIdx] });
    
    // Create a simple menu with options
    const menuOptions = [
      { label: 'Set Available', action: 'available' as const },
      { label: 'Stop Sell', action: 'stop_sell' as const },
    ];
    
    // Show context menu or modal
    setPendingAction(null); // Clear any pending action first
    setShowConfirmationModal(true);
  };

  // Convert a single date index into a date range (single day)
  const indexToDateRange = (dateIdx: number): { startDate: string; endDate: string } => {
    return {
      startDate: dateToString(dates[dateIdx]),
      endDate: dateToString(dates[dateIdx]),
    };
  };

  // Handle single cell action after confirmation
  const handleConfirmCellAction = async () => {
    if (!pendingAction || !pendingCellData || !propertyId) {
      setShowConfirmationModal(false);
      setPendingCellData(null);
      return;
    }

    try {
      const { roomId, startDate, endDate } = pendingCellData;
      const startDateStr = dateToString(startDate);
      const endDateStr = dateToString(endDate);

      console.log(`[Cell Action] Updating cell - room=${roomId}, startDate=${startDateStr}, endDate=${endDateStr}, status=${pendingAction}`);

      // Call the simple update-availability API
      const response = await fetch('/api/property-settings/rates-availability/update-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomId,
          startDate: startDateStr,
          endDate: endDateStr,
          status: pendingAction,
        }),
      });

      const responseData = await response.json();
      console.log('[Cell Action] API response:', { status: response.status, message: responseData.message });
      
      if (!response.ok) {
        console.error('[Cell Action] API error:', responseData);
        throw new Error(responseData?.error || 'Failed to save availability');
      }

      console.log(`[Cell Action] ✅ Update successful`);
      
      // Close modal and refresh
      setShowConfirmationModal(false);
      setPendingAction(null);
      setPendingCellData(null);
      
      // ✅ Refresh calendar data to show updated status
      console.log('[Cell Action] Refreshing calendar data...');
      // Trigger a refetch by updating a state that the useEffect depends on
      // We can use refreshTrigger or re-fetch directly
      if (dates.length > 0 && propertyId) {
        const minDate = dateToString(dates[0]);
        const maxDate = dateToString(dates[dates.length - 1]);
        const allRoomIds = Object.values(rooms).flat().map(r => r.id);
        const roomTypeIds = Object.keys(rooms);
        
        const params = new URLSearchParams({
          propertyId,
          minDate,
          maxDate,
          roomIds: allRoomIds.join(','),
          roomTypeIds: roomTypeIds.join(','),
        });
        
        const refreshResponse = await fetch(`/api/property-settings/rates-availability/calendar?${params}`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const availabilityData = refreshData.availability || [];
          
          console.log('[Cell Action] 📥 Refreshed calendar data from API:', {
            totalRecords: availabilityData.length,
            firstRecord: availabilityData[0],
            lastRecord: availabilityData[availabilityData.length - 1],
          });
          
          // Log detailed view of sample records
          const sampleRecords = availabilityData.slice(0, 5).map((r: any) => ({
            room_id: r.room_id,
            date: r.date,
            end_date: r.end_date,
            status: r.status,
          }));
          console.log('[Cell Action] 📋 Sample records (first 5):', sampleRecords);
          
          // Log records from the specific room we just updated
          const updatedRoomId = pendingAction ? Object.values(dates)[0]?.room_id : null;
          if (updatedRoomId) {
            const roomRecords = availabilityData
              .filter((r: any) => r.room_id === updatedRoomId)
              .slice(0, 10);
            console.log(`[Bulk Action] 🔍 Records for updated room (${updatedRoomId}):`, 
              roomRecords.map((r: any) => ({
                date: r.date,
                end_date: r.end_date,
                status: r.status,
              }))
            );
          }
          
          // Rebuild the data map with fresh data
          const newDataMap = new Map<string, AvailabilityData>();
          const roomToRoomType = new Map<string, string>();
          
          Object.entries(rooms).forEach(([roomTypeId, roomsList]) => {
            roomsList.forEach(room => {
              roomToRoomType.set(room.id, roomTypeId);
            });
          });
          
          availabilityData.forEach((item: AvailabilityData) => {
            if (item.room_id) {
              const key = `${item.room_id}-${item.date}`;
              
              // ✅ NEW: Handle overlapping records - prefer more specific (shorter) ranges
              const existingItem = newDataMap.get(key);
              let shouldSet = true;
              
              if (existingItem) {
                // Both have ranges - compare specificity (shorter range wins)
                const existingRangeLength = existingItem.end_date ? 
                  new Date(existingItem.end_date).getTime() - new Date(existingItem.date).getTime() :
                  0;
                const newRangeLength = item.end_date ? 
                  new Date(item.end_date).getTime() - new Date(item.date).getTime() :
                  0;
                
                shouldSet = newRangeLength < existingRangeLength;
                if (shouldSet) {
                  console.log(`[Map Update] Replacing ${key}: shorter range (${newRangeLength}ms) replaces longer (${existingRangeLength}ms)`);
                }
              }
              
              if (shouldSet) {
                newDataMap.set(key, item);
              }
              
              if (item.end_date && item.end_date !== item.date) {
                const dateRangeStrings = expandDateRange(item.date, item.end_date);
                for (let i = 1; i < dateRangeStrings.length; i++) {
                  const dateStr = dateRangeStrings[i];
                  const expandedKey = `${item.room_id}-${dateStr}`;
                  
                  // ✅ Check overlap for expanded dates too
                  const existingExpanded = newDataMap.get(expandedKey);
                  let shouldSetExpanded = true;
                  
                  if (existingExpanded) {
                    const existingRangeLength = existingExpanded.end_date ? 
                      new Date(existingExpanded.end_date).getTime() - new Date(existingExpanded.date).getTime() :
                      0;
                    const newRangeLength = item.end_date ? 
                      new Date(item.end_date).getTime() - new Date(item.date).getTime() :
                      0;
                    
                    shouldSetExpanded = newRangeLength < existingRangeLength;
                  }
                  
                  if (shouldSetExpanded) {
                    newDataMap.set(expandedKey, {
                      ...item,
                      date: dateStr,
                    });
                  }
                }
              }
            }
          });
          
          setAvailabilityDataMap(newDataMap);
          console.log('[Cell Action] Calendar data refreshed - new map size:', newDataMap.size);
        }
      }
      
      // ✅ NEW: Refresh calendar data to show updated status
      console.log('[Cell Action] Refreshing calendar data...');
      await refreshCalendarData();
      
      alert('Cell updated successfully!');
    } catch (error) {
      console.error('[Cell Action] Error:', error instanceof Error ? error.message : error);
      alert(error instanceof Error ? error.message : 'Failed to update cell');
    } finally {
      setShowConfirmationModal(false);
    }
  };

  // Handler to toggle room availability (Available ↔ Not Available)
  const handleRoomAvailabilityToggle = async (roomId: string, roomTypeId: string, dateIndex: number, dateRange?: { start: Date; end: Date }) => {
    if (!propertyId) return;
    
    setIsUpdatingCell(true);
    try {
      // Use provided date range or just the single cell date
      let startDate: Date, endDate: Date;
      
      if (dateRange) {
        startDate = dateRange.start;
        endDate = dateRange.end;
      } else {
        const date = dates[dateIndex];
        startDate = date;
        endDate = date;
      }

      const startDateStr = dateToString(startDate);
      const endDateStr = dateToString(endDate);
      
      // Always set to 'not_available' (Stop Sell) for cell clicks
      const newStatus = 'not_available';
      
      console.log('[Room Cell Toggle] Attempting to update:', {
        roomId,
        startDate: startDateStr,
        endDate: endDateStr,
        newStatus,
        reason: selectedReason,
        notes: reasonNotes,
        propertyId,
      });
      
      // Call API to update availability for date range
      const response = await fetch('/api/property-settings/rates-availability/update-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomId,
          roomTypeId,
          startDate: startDateStr,
          endDate: endDateStr,
          status: newStatus,
          reason: selectedReason,
          reasonDetails: selectedReason === 'other' ? reasonNotes : null,
          notes: reasonNotes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Room Cell Toggle] API error response:', { status: response.status, errorData });
        throw new Error(errorData?.error || 'Failed to update availability');
      }

      const responseData = await response.json();
      console.log('[Room Cell Toggle] Success:', responseData);

      // Close the popover immediately
      setPopoverState(null);
      setPopoverDateRange(null);

      // Reset reason/notes after save
      setSelectedReason('stop_sell');
      setReasonNotes('');

      // Refresh calendar data from API to show latest state
      // This will fetch the actual saved data instead of using temporary local state
      console.log('[Room Cell Toggle] Refreshing calendar data...');
      await refreshCalendarData();
    } catch (error) {
      console.error('[Room Cell Toggle] Error:', error instanceof Error ? error.message : error);
    } finally {
      setIsUpdatingCell(false);
    }
  };

  // Handler to delete a stop sell block
  const handleDeleteBlock = async (roomId: string, date: Date) => {
    if (!propertyId) return;
    
    setIsUpdatingCell(true);
    try {
      const dateStr = dateToString(date);
      
      console.log('[Delete Block] Attempting to delete:', {
        roomId,
        date: dateStr,
        propertyId,
      });
      
      // Call API to delete the block for this date
      const response = await fetch('/api/property-settings/rates-availability/delete-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomId,
          date: dateStr,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Delete Block] API error response:', { status: response.status, errorData });
        throw new Error(errorData?.error || 'Failed to delete block');
      }

      const responseData = await response.json();
      console.log('[Delete Block] Success:', responseData);

      // Close the popover immediately
      setPopoverState(null);
      setPopoverDateRange(null);
      setBlockPopoverState(null);

      // Refresh calendar data from API to show the opened dates
      console.log('[Delete Block] Refreshing calendar data...');
      await refreshCalendarData();
    } catch (error) {
      console.error('[Delete Block] Error:', error instanceof Error ? error.message : error);
      alert(error instanceof Error ? error.message : 'Failed to delete block');
    } finally {
      setIsUpdatingCell(false);
    }
  };

  // Handler to save an edited block (different dates)
  const handleEditBlock = async () => {
    if (!propertyId || !blockEditingData || !blockPopoverState) return;

    setIsUpdatingCell(true);
    try {
      // Find the block we're editing to get its current start date
      const blocks = getBlocksForRoom(blockPopoverState.roomId);
      const blockToEdit = blocks[blockPopoverState.blockIndex];
      
      if (!blockToEdit) {
        throw new Error('Block not found');
      }

      console.log('[Edit Block] Saving edited block:', {
        roomId: blockPopoverState.roomId,
        currentStartDate: dateToString(blockToEdit.startDate),
        newStartDate: dateToString(blockEditingData.startDate),
        newEndDate: dateToString(blockEditingData.endDate),
      });

      // Call the update-block-dates endpoint to directly update the record's date fields
      // This directly updates the start_date and end_date of the existing record
      const response = await fetch('/api/property-settings/rates-availability/update-block-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomId: blockPopoverState.roomId,
          roomTypeId: blockPopoverState.roomTypeId,
          currentStartDate: dateToString(blockToEdit.startDate),
          newStartDate: dateToString(blockEditingData.startDate),
          newEndDate: dateToString(blockEditingData.endDate),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Edit Block] API error:', errorData);
        throw new Error(errorData?.error || 'Failed to save edited block');
      }

      const responseData = await response.json();
      console.log('[Edit Block] Success:', responseData);

      // Close the popover and reset editing state
      setBlockPopoverState(null);
      setIsEditingBlock(false);
      setBlockEditingData(null);

      // Refresh calendar data
      console.log('[Edit Block] Refreshing calendar data...');
      await refreshCalendarData();
      
      alert('Block updated successfully! Unblocked dates are now available.');
    } catch (error) {
      console.error('[Edit Block] Error:', error instanceof Error ? error.message : error);
      alert(error instanceof Error ? error.message : 'Failed to update block');
    } finally {
      setIsUpdatingCell(false);
    }
  };

  // Handler to save restrictions for a room type
  const handleSaveRestrictions = async () => {
    if (!selectedRoomTypeForRestriction || !propertyId) return;
    
    setIsUpdatingRestriction(true);
    try {
      const startDateStr = dateToString(restrictionFormData.restrictionStartDate);
      const endDateStr = dateToString(restrictionFormData.restrictionEndDate);
      
      console.log('[Restrictions Modal] Saving restrictions:', {
        roomTypeId: selectedRoomTypeForRestriction.id,
        minNights: restrictionFormData.minNights,
        maxNights: restrictionFormData.maxNights,
        closeToArrival: restrictionFormData.closeToArrival,
        closeToDeparture: restrictionFormData.closeToDeparture,
        startDate: startDateStr,
        endDate: endDateStr,
      });

      // Call the restrictions API with restrictions array
      const response = await fetch('/api/property-settings/rates-availability/restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          restrictions: [
            {
              roomTypeId: selectedRoomTypeForRestriction.id,
              date: startDateStr,
              endDate: endDateStr,
              minStay: restrictionFormData.minNights,
              maxStay: restrictionFormData.maxNights,
              closeToArrival: restrictionFormData.closeToArrival,
              closeToDeparture: restrictionFormData.closeToDeparture,
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Restrictions Modal] API error:', errorData);
        throw new Error(errorData?.error || 'Failed to save restrictions');
      }

      console.log('[Restrictions Modal] Restrictions saved successfully');
      setRestrictionModalOpen(false);
      setSelectedRoomTypeForRestriction(null);
      
      // ✅ NEW: Refresh calendar data to show updated restrictions
      console.log('[Restrictions Modal] Refreshing calendar data...');
      await refreshCalendarData();
      
      alert('Restrictions updated successfully!');
    } catch (error) {
      console.error('[Restrictions Modal] Error:', error instanceof Error ? error.message : error);
      alert(error instanceof Error ? error.message : 'Failed to save restrictions');
    } finally {
      setIsUpdatingRestriction(false);
    }
  };

  // Helper function to refresh calendar data from API
  const refreshCalendarData = async () => {
    if (!propertyId || dates.length === 0) {
      console.log('[Refresh] Skipping refresh: missing propertyId or dates');
      return;
    }

    try {
      console.log('[Refresh] Starting calendar data refresh...');
      const minDate = dateToString(dates[0]);
      const maxDate = dateToString(dates[dates.length - 1]);
      const allRoomIds = Object.values(rooms).flat().map(r => r.id);
      const roomTypeIds = Object.keys(rooms);
      
      const params = new URLSearchParams({
        propertyId,
        minDate,
        maxDate,
        roomIds: allRoomIds.join(','),
        roomTypeIds: roomTypeIds.join(','),
      });
      
      const response = await fetch(`/api/property-settings/rates-availability/calendar?${params}`);
      if (!response.ok) {
        console.error('[Refresh] API error:', response.status);
        return;
      }

      const responseData = await response.json();
      const data = responseData.availability || [];
      const rateOverrides = responseData.rateOverrides || [];
      
      console.log('[Refresh] 📥 Fetched fresh data:', {
        totalRecords: data.length,
        rateOverridesCount: rateOverrides.length,
        dateRange: `${minDate} to ${maxDate}`,
      });

      // Create room to room type mapping
      const roomToRoomType = new Map<string, string>();
      Object.entries(rooms).forEach(([roomTypeId, roomsList]) => {
        roomsList.forEach(room => {
          roomToRoomType.set(room.id, roomTypeId);
        });
      });

      // Rebuild the data map with fresh data
      const newDataMap = new Map<string, AvailabilityData>();
      
      data.forEach((item: AvailabilityData) => {
        if (item.room_id) {
          const key = `${item.room_id}-${item.date}`;
          
          // Handle overlapping records - prefer more specific (shorter) ranges
          const existingItem = newDataMap.get(key);
          let shouldSet = true;
          
          if (existingItem) {
            const existingRangeLength = existingItem.end_date ? 
              new Date(existingItem.end_date).getTime() - new Date(existingItem.date).getTime() :
              0;
            const newRangeLength = item.end_date ? 
              new Date(item.end_date).getTime() - new Date(item.date).getTime() :
              0;
            
            shouldSet = newRangeLength < existingRangeLength;
          }
          
          if (shouldSet) {
            newDataMap.set(key, item);
          }
          
          // Expand date ranges
          if (item.end_date && item.end_date !== item.date) {
            let current = new Date(item.date);
            const end = new Date(item.end_date);
            while (current < end) {
              current.setDate(current.getDate() + 1);
              // ✅ USE PROPER LOCAL TIMEZONE CONVERSION (not ISO which uses UTC)
              const expandedDateStr = dateToString(current);
              const expandedKey = `${item.room_id}-${expandedDateStr}`;
              
              const existingExpanded = newDataMap.get(expandedKey);
              let shouldSetExpanded = true;
              
              if (existingExpanded) {
                const existingRangeLength = existingExpanded.end_date ? 
                  new Date(existingExpanded.end_date).getTime() - new Date(existingExpanded.date).getTime() :
                  0;
                const newRangeLength = item.end_date ? 
                  new Date(item.end_date).getTime() - new Date(item.date).getTime() :
                  0;
                
                shouldSetExpanded = newRangeLength < existingRangeLength;
              }
              
              if (shouldSetExpanded) {
                newDataMap.set(expandedKey, { ...item, date: expandedDateStr });
              }
            }
          }
        }
      });

      // ✅ NEW: Process rate overrides separately
      // Key: roomTypeId-date-ratePlanId -> override data for direct lookup
      console.log('[Refresh] Processing rate overrides...');
      rateOverrides.forEach((override: any) => {
        const key = `${override.room_type_id}-${override.date}-${override.rate_plan_id}`;
        newDataMap.set(key, {
          room_type_id: override.room_type_id,
          date: override.date,
          end_date: override.end_date,
          status: 'override',
          override_type: override.override_type,
          override_value: override.override_value,
          derive_pricing: override.derive_pricing,
          rate_plan_ids: [override.rate_plan_id],
        } as any);
        
        // Also expand rate overrides for the date range
        if (override.end_date && override.end_date !== override.date) {
          let current = new Date(override.date);
          const end = new Date(override.end_date);
          while (current < end) {
            current.setDate(current.getDate() + 1);
            // ✅ USE PROPER LOCAL TIMEZONE CONVERSION (not ISO which uses UTC)
            const expandedDateStr = dateToString(current);
            const expandedKey = `${override.room_type_id}-${expandedDateStr}-${override.rate_plan_id}`;
            newDataMap.set(expandedKey, {
              room_type_id: override.room_type_id,
              date: expandedDateStr,
              end_date: override.end_date,
              status: 'override',
              override_type: override.override_type,
              override_value: override.override_value,
              derive_pricing: override.derive_pricing,
              rate_plan_ids: [override.rate_plan_id],
            } as any);
          }
        }
      });
      console.log('[Refresh] ✅ Processed rate overrides');

      setAvailabilityDataMap(newDataMap);
      console.log('[Refresh] ✅ Calendar data updated - new map size:', newDataMap.size);
    } catch (error) {
      console.error('[Refresh] Error:', error instanceof Error ? error.message : error);
    }
  };

  // Handle saving default rate for a date
  const handleSaveDefaultRate = async () => {
    if (!selectedRoomTypeForRateEdit || editingRateDateIndex === null) return;

    const rateValue = parseFloat(editingRateValue);
    if (isNaN(rateValue) || rateValue < 0) {
      alert('Please enter a valid price');
      return;
    }

    const startDateStr = dateToString(rateEditStartDate);
    const endDateStr = dateToString(rateEditEndDate);

    try {
      setIsUpdatingRate(true);
      console.log('[Rate Edit Modal] Saving default rate:', {
        propertyId,
        roomTypeId: selectedRoomTypeForRateEdit.id,
        startDate: startDateStr,
        endDate: endDateStr,
        price: rateValue,
      });

      // Find the default rate plan for this room type
      const defaultRatePlan = getRatePlansForRoomType(selectedRoomTypeForRateEdit.id).find(rp => rp.default);
      if (!defaultRatePlan) {
        throw new Error('No default rate plan found for this room type');
      }

      const response = await fetch('/api/property-settings/rates-availability/rate-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomTypeId: selectedRoomTypeForRateEdit.id,
          ratePlanId: defaultRatePlan.id,
          date: startDateStr,
          endDate: endDateStr,
          overrideType: 'fixed',
          overrideValue: rateValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Rate Edit Modal] API error:', errorData);
        throw new Error(errorData?.error || 'Failed to save rate override');
      }

      console.log('[Rate Edit Modal] Rate saved successfully');
      setRateEditModalOpen(false);
      setSelectedRoomTypeForRateEdit(null);
      setEditingRateValue('');
      setEditingRateDateIndex(null);
      
      // ✅ NEW: Refresh calendar data to show updated rates
      console.log('[Rate Edit Modal] Refreshing calendar data...');
      await refreshCalendarData();
      
      alert('Rate updated successfully!');
    } catch (error) {
      console.error('[Rate Edit Modal] Error:', error instanceof Error ? error.message : error);
      alert(error instanceof Error ? error.message : 'Failed to save rate');
    } finally {
      setIsUpdatingRate(false);
    }
  };

  // Handle saving rate override for a specific rate plan
  const handleSaveRateOverride = async () => {
    if (!selectedRatePlanForOverride || selectedDateIndexForRateOverride === null) return;

    try {
      setIsUpdatingRateOverride(true);

      let overrideType = overrideFormData.overrideType;
      let overrideValue: number;

      if (overrideType === 'fixed') {
        overrideValue = parseFloat(overrideFormData.fixedPrice);
        if (isNaN(overrideValue) || overrideValue < 0) {
          alert('Please enter a valid fixed price');
          return;
        }
      } else {
        overrideValue = parseFloat(overrideFormData.percentageValue);
        if (isNaN(overrideValue) || overrideValue < -100 || overrideValue > 1000) {
          alert('Please enter a valid percentage (-100 to 1000)');
          return;
        }
      }

      const startDateStr = dateToString(overrideFormData.rateOverrideStartDate);
      const endDateStr = dateToString(overrideFormData.rateOverrideEndDate);

      console.log('[Rate Override Modal] Saving rate override:', {
        propertyId,
        roomTypeId: selectedRatePlanForOverride.roomTypeId,
        ratePlanId: selectedRatePlanForOverride.id,
        startDate: startDateStr,
        endDate: endDateStr,
        overrideType,
        overrideValue,
      });

      const response = await fetch('/api/property-settings/rates-availability/rate-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomTypeId: selectedRatePlanForOverride.roomTypeId,
          ratePlanId: selectedRatePlanForOverride.id,
          date: startDateStr,
          endDate: endDateStr,
          overrideType,
          overrideValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Rate Override Modal] API error:', errorData);
        throw new Error(errorData?.error || 'Failed to save rate override');
      }

      console.log('[Rate Override Modal] Rate override saved successfully');
      setRateOverrideModalOpen(false);
      setSelectedRatePlanForOverride(null);
      setSelectedDateIndexForRateOverride(null);
      setOverrideFormData({ overrideType: 'fixed', fixedPrice: '', percentageValue: '', rateOverrideStartDate: new Date(), rateOverrideEndDate: new Date() });
      
      // ✅ NEW: Refresh calendar data to show updated overrides
      console.log('[Rate Override Modal] Refreshing calendar data...');
      await refreshCalendarData();
      
      alert('Rate override updated successfully!');
    } catch (error) {
      console.error('[Rate Override Modal] Error:', error instanceof Error ? error.message : error);
      alert(error instanceof Error ? error.message : 'Failed to save rate override');
    } finally {
      setIsUpdatingRateOverride(false);
    }
  };

  // Helper function to get rate override for a specific rate plan and date
  const getRateOverrideForPlanDate = (roomTypeId: string, ratePlanId: string, dateIndex: number): { hasOverride: boolean; overriddenPrice?: number; overrideType?: string; baseOverrideValue?: number } => {
    const date = dates[dateIndex];
    // ✅ FIX: Use consistent date string format for lookup
    const dateStr = dateToString(date);
    
    // ✅ UPDATED: Look up using room_type_id + date + rate_plan_id (NO room.id needed)
    const lookupKey = `${roomTypeId}-${dateStr}-${ratePlanId}`;
    const roomData = availabilityDataMap.get(lookupKey);
    
    if (!roomData?.override_type || roomData?.override_value === null) {
      return { hasOverride: false };
    }

    // Calculate the overridden price
    const ratePlan = ratePlans.find(p => p.id === ratePlanId);
    const basePrice = ratePlan?.basePrice;
    
    if (!basePrice) {
      return { hasOverride: false };
    }

    let overriddenPrice: number | undefined;
    if (roomData.override_type === 'fixed') {
      overriddenPrice = roomData.override_value;
    } else if (roomData.override_type === 'percentage') {
      overriddenPrice = basePrice * (1 + roomData.override_value / 100);
    }

    return {
      hasOverride: true,
      overriddenPrice,
      overrideType: roomData.override_type,
      baseOverrideValue: roomData.override_value,
    };
  };

  // Helper function to get rate override for a specific room and date
  const getRateOverrideForRoomDate = (roomId: string, dateIndex: number): AvailabilityData | undefined => {
    const date = dates[dateIndex];
    const dateStr = dateToString(date);
    return availabilityDataMap.get(`${roomId}-${dateStr}`);
  };

  // Helper function to get override rate or base rate
  const getPriceForRoomDate = (roomTypeId: string, roomId: string, dateIndex: number): { base: number | undefined; final: number | undefined; hasOverride: boolean } => {
    const baseRate = getDefaultRate(roomTypeId);
    const rateData = getRateOverrideForRoomDate(roomId, dateIndex);
    
    if (!rateData?.override_type || !baseRate) {
      return { base: baseRate, final: undefined, hasOverride: false };
    }

    const overrideValue = rateData.override_value || 0;
    
    if (rateData.override_type === 'percentage') {
      const finalPrice = baseRate * (1 + overrideValue / 100);
      return { base: baseRate, final: finalPrice, hasOverride: true };
    } else if (rateData.override_type === 'fixed') {
      return { base: baseRate, final: overrideValue, hasOverride: true };
    }

    return { base: baseRate, final: undefined, hasOverride: false };
  };

  // Helper function to extract block bars for a room across the visible date range
  interface BlockBar {
    startDateIndex: number;
    endDateIndex: number;
    startDate: Date;
    endDate: Date;
    reason?: string | null;
    reason_details?: string | null;
    notes?: string | null;
  }

  const getBlocksForRoom = (roomId: string): BlockBar[] => {
    const blocks: BlockBar[] = [];
    const DAY_WIDTH = 96; // w-24 = 96px
    
    // Find all 'not_available' records for this room
    const notAvailableRecords: AvailabilityData[] = [];
    availabilityDataMap.forEach((data) => {
      if (data.room_id === roomId && data.status === 'not_available') {
        notAvailableRecords.push(data);
      }
    });

    if (notAvailableRecords.length === 0) return [];

    // Group records into continuous date ranges (blocks)
    const processedDates = new Set<string>();
    
    notAvailableRecords.forEach((record) => {
      const recordStartStr = record.date;
      
      // Skip if we've already processed this as part of a range
      if (processedDates.has(recordStartStr)) return;
      
      const recordStart = stringToDate(recordStartStr);
      let recordEnd = record.end_date ? stringToDate(record.end_date) : recordStart;
      
      // Find the start index in the visible dates
      let startDateIndex = -1;
      let endDateIndex = -1;
      
      for (let i = 0; i < dates.length; i++) {
        const dateStr = dateToString(dates[i]);
        
        if (dateStr === recordStartStr && startDateIndex === -1) {
          startDateIndex = i;
        }
        
        // Check if this date is within or at the end of the record
        const currentDate = stringToDate(dateStr);
        if (currentDate >= recordStart && currentDate <= recordEnd) {
          endDateIndex = i;
          processedDates.add(dateStr);
        }
      }
      
      // Only add if the block is visible in the current date range
      if (startDateIndex !== -1) {
        blocks.push({
          startDateIndex,
          endDateIndex: endDateIndex !== -1 ? endDateIndex : startDateIndex,
          startDate: recordStart,
          endDate: recordEnd,
          reason: record.reason,
          reason_details: record.reason_details,
          notes: record.notes,
        });
      }
    });

    return blocks;
  };

  // Fetch availability data from Supabase
  useEffect(() => {
    const fetchAvailabilityData = async () => {
      if (!propertyId || dates.length === 0) {
        setAvailabilityDataMap(new Map());
        return;
      }

      try {
        // Get date range
        const minDate = dateToString(dates[0]);
        const maxDate = dateToString(dates[dates.length - 1]);

        // Get all room IDs
        const allRoomIds = Object.values(rooms).flat().map(r => r.id);
        if (allRoomIds.length === 0) {
          setAvailabilityDataMap(new Map());
          return;
        }

        // ✅ NEW: Get room type IDs for rate override lookups
        const roomTypeIds = Object.keys(rooms);

        // Query availability data from API
        const params = new URLSearchParams({
          propertyId,
          minDate,
          maxDate,
          roomIds: allRoomIds.join(','),
          roomTypeIds: roomTypeIds.join(','),  // ✅ NEW: Pass room type IDs for rate lookups
        });

        const response = await fetch(`/api/property-settings/rates-availability/calendar?${params}`);
        if (!response.ok) {
          const errorData = await response.json();
          console.error('[Calendar Component] API error response:', errorData);
          throw new Error(`Failed to fetch availability: ${errorData?.message || response.statusText}`);
        }

        const responseData: any = await response.json();
        const data: AvailabilityData[] = responseData.availability || [];
        const rateOverrides: any[] = responseData.rateOverrides || [];

        // ✅ NEW: Log raw API response structure
        console.log('[Calendar Component] 🔍 Raw API response structure:', {
          hasAvailability: !!responseData.availability,
          availabilityCount: data.length,
          hasRateOverrides: !!responseData.rateOverrides,
          rateOverridesCount: rateOverrides.length,
        });
        if (data.length > 0) {
          console.log('[Calendar Component] 📋 First 5 API records:', data.slice(0, 5).map((r, i) => ({
            idx: i,
            room_id: r.room_id,
            date: r.date,
            end_date: r.end_date,
            status: r.status,
          })));
        }

        // ✅ NEW: Create a mapping of roomId -> roomTypeId for easy lookups
        const roomToRoomType = new Map<string, string>();
        Object.entries(rooms).forEach(([roomTypeId, roomsList]) => {
          roomsList.forEach(room => {
            roomToRoomType.set(room.id, roomTypeId);
          });
        });

        // ✅ Helper: Check if a date string matches applied_days filter
        // appliedDays: [0,1,2,3,4] = Mon-Fri, [5,6] = Sat-Sun, null/[] = all days
        const isDateMatchingAppliedDays = (dateStr: string, appliedDays: number[] | null | undefined): boolean => {
          if (!appliedDays || appliedDays.length === 0) return true; // No filter = all days
          
          const date = new Date(dateStr + 'T00:00:00Z');
          const dayOfWeek = date.getUTCDay();
          // Convert JS day (0=Sunday) to our format (0=Monday)
          const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          return appliedDays.includes(dayIndex);
        };

        // Create a map for quick lookup: "roomId-date" -> AvailabilityData
        const dataMap = new Map<string, AvailabilityData>();
        
        console.log(`[Calendar Component] 📥 Received ${data.length} availability records from API`);
        
        // Process availability data (room-level only)
        data.forEach((item, index) => {
          if (item.room_id) {
            // Log every record to see which ones have end_date
            if (index < 20 || item.end_date) {
              console.log(`[Calendar Component] Record #${index}: room=${item.room_id}, date=${item.date}, end_date=${item.end_date}, status=${item.status}`);
            }
            
            // ✅ NEW: Handle overlapping records - prefer more specific (shorter) ranges
            const key = `${item.room_id}-${item.date}`;
            const existingItem = dataMap.get(key);
            let shouldSet = true;
            
            if (existingItem) {
              const existingRangeLength = existingItem.end_date ? 
                new Date(existingItem.end_date).getTime() - new Date(existingItem.date).getTime() :
                0;
              const newRangeLength = item.end_date ? 
                new Date(item.end_date).getTime() - new Date(item.date).getTime() :
                0;
              
              shouldSet = newRangeLength < existingRangeLength;
              if (shouldSet) {
                console.log(`[Overlap] Replacing ${key}: shorter range (${newRangeLength}ms) replaces longer (${existingRangeLength}ms)`);
              }
            }
            
            if (shouldSet) {
              dataMap.set(key, item);
            }

            // If this is a range (has end_date), add entries for all dates in the range
            if (item.end_date && item.end_date !== item.date) {
              // Log range records
              console.log(`📍 [Calendar Component] Found range record #${index + 1}: room=${item.room_id}, date=${item.date}, end_date=${item.end_date}, status=${item.status}, applied_days=${JSON.stringify(item.applied_days)}`);
              
              // ✅ FIX: Use date utilities for consistent string-based expansion
              const dateRangeStrings = expandDateRange(item.date, item.end_date);
              console.log(`  📍 Expanding to ${dateRangeStrings.length} dates: ${dateRangeStrings.slice(0, 5).join(', ')}${dateRangeStrings.length > 5 ? '...' : ''}`);
              
              // ✅ NEW: Filter by applied_days if specified
              const applicableDates = item.applied_days && item.applied_days.length > 0
                ? dateRangeStrings.filter(dateStr => isDateMatchingAppliedDays(dateStr, item.applied_days))
                : dateRangeStrings;
              
              if (item.applied_days && item.applied_days.length > 0) {
                console.log(`  ✅ Applied_days filter [${item.applied_days.join(',')}]: ${dateRangeStrings.length} dates -> ${applicableDates.length} matching dates`);
              }
              
              // Add entries for all dates in the range (skip first since we already added it)
              for (let i = 1; i < applicableDates.length; i++) {
                const dateStr = applicableDates[i];
                const expandedKey = `${item.room_id}-${dateStr}`;
                
                // ✅ Check overlap for expanded dates too
                const existingExpanded = dataMap.get(expandedKey);
                let shouldSetExpanded = true;
                
                if (existingExpanded) {
                  const existingRangeLength = existingExpanded.end_date ? 
                    new Date(existingExpanded.end_date).getTime() - new Date(existingExpanded.date).getTime() :
                    0;
                  const newRangeLength = item.end_date ? 
                    new Date(item.end_date).getTime() - new Date(item.date).getTime() :
                    0;
                  
                  shouldSetExpanded = newRangeLength < existingRangeLength;
                }
                
                if (shouldSetExpanded) {
                  dataMap.set(expandedKey, {
                    ...item,
                    date: dateStr,
                  });
                }
              }
              console.log(`  ✅ Added ${applicableDates.length - 1} expanded entries to map (filtered by applied_days)`);
            }
          }
        });

        // ✅ NEW: Process rate overrides separately
        // Key: roomTypeId-date-ratePlanId -> override data for direct lookup
        rateOverrides.forEach(override => {
          const key = `${override.room_type_id}-${override.date}-${override.rate_plan_id}`;
          dataMap.set(key, {
            room_type_id: override.room_type_id,
            date: override.date,
            end_date: override.end_date,
            status: 'override',
            override_type: override.override_type,
            override_value: override.override_value,
            derive_pricing: override.derive_pricing,
            rate_plan_ids: [override.rate_plan_id],
          } as any);
          
          // ✅ NEW: If override has end_date, add entries for all dates in range
          if (override.end_date && override.end_date !== override.date) {
            // ✅ FIX: Use date utilities for clean string-based expansion
            const dateRangeStrings = expandDateRange(override.date, override.end_date);
            
            // ✅ NEW: Filter by applied_days if specified
            const applicableDates = override.applied_days && override.applied_days.length > 0
              ? dateRangeStrings.filter(dateStr => isDateMatchingAppliedDays(dateStr, override.applied_days))
              : dateRangeStrings;
            
            // Add entries for all dates in the range (skip first since we already added it)
            for (let i = 1; i < applicableDates.length; i++) {
              const dateStr = applicableDates[i];
              const rangeKey = `${override.room_type_id}-${dateStr}-${override.rate_plan_id}`;
              dataMap.set(rangeKey, {
                room_type_id: override.room_type_id,
                date: dateStr,
                end_date: override.end_date,
                status: 'override',
                override_type: override.override_type,
                override_value: override.override_value,
                derive_pricing: override.derive_pricing,
                rate_plan_ids: [override.rate_plan_id],
              } as any);
            }
          }
        });

        console.log(`📊 [Calendar Component] Final data map contains ${dataMap.size} total entries`);
        const sampleEntries = Array.from(dataMap.entries()).slice(0, 5);
        console.log(`📊 [Calendar Component] Sample map entries:`, sampleEntries.map(([key, val]) => ({
          key,
          room_id: val.room_id,
          date: val.date,
          end_date: val.end_date,
          status: val.status
        })));
        
        setAvailabilityDataMap(dataMap);
      } catch (error) {
        console.error('Error fetching availability data:', error);
        setAvailabilityDataMap(new Map());
      }
    };

    fetchAvailabilityData();
  }, [propertyId, dates, rooms, refreshTrigger]);

  // Populate block reason/details/notes when block popover is opened
  useEffect(() => {
    if (blockPopoverState?.open && blockPopoverState?.roomId && blockPopoverState?.blockIndex !== undefined) {
      const blocks = getBlocksForRoom(blockPopoverState.roomId);
      const selectedBlock = blocks[blockPopoverState.blockIndex];
      
      if (selectedBlock) {
        setBlockReason(selectedBlock.reason || 'stop_sell');
        // reason_details is the custom reason text when reason='other'
        setBlockReasonDetails(selectedBlock.reason_details || '');
      }
    }
  }, [blockPopoverState?.open, blockPopoverState?.roomId, blockPopoverState?.blockIndex]);

  // Get the color for the selected availability
  const selectedColor = useMemo(() => {
    if (selectedAvailability.length === 0) return null;
    const option = availabilityOptions.find(o => o.id === selectedAvailability[0]);
    return option?.color || null;
  }, [selectedAvailability, availabilityOptions]);

  // Determine which room types to show
  const visibleRoomTypes = useMemo(() => {
    if (selectedRoomType === 'all') {
      return roomTypes;
    }
    return roomTypes.filter(rt => rt.id === selectedRoomType);
  }, [selectedRoomType, roomTypes]);



  // Helper function to get the color for a room-date cell based on Supabase data
  const getCellColor = (roomId: string, dateIndex: number): string | null => {
    const dateStr = dateToString(dates[dateIndex]);
    const key = `${roomId}-${dateStr}`;
    
    // Debug log for first room's first few dates
    const firstRoomId = Object.values(rooms).flat()[0]?.id;
    const shouldDebugLog = dateIndex < 3 && roomId === firstRoomId;
    
    if (shouldDebugLog) {
      console.log(`🎨 [getCellColor] Checking: room=${roomId}, dateIndex=${dateIndex}, date=${dateStr}, key=${key}, mapSize=${availabilityDataMap.size}`);
    }
    
    const availData = availabilityDataMap.get(key);

    if (availData) {
      if (shouldDebugLog) {
        console.log(`  ✅ Found data! status=${availData.status}, date=${availData.date}, end_date=${availData.end_date}, color=${STATUS_COLOR_MAP[availData.status]}`);
      }
      // Return the color for this status
      return STATUS_COLOR_MAP[availData.status] || null;
    }

    if (shouldDebugLog) {
      console.log(`  ❌ No data found for key: ${key}`);
      // Log a few nearby keys to help debug
      const nearbyKeys = Array.from(availabilityDataMap.keys())
        .filter(k => k.startsWith(`${roomId}-`))
        .slice(0, 3);
      console.log(`  📝 Some keys for this room:`, nearbyKeys);
    }

    // No data available for this room-date combination
    return null;
  };

  // Calculate selected cell count
  const selectedCount = useMemo(() => {
    return Array.from(selectedCells.values()).reduce((sum, set) => sum + set.size, 0);
  }, [selectedCells]);

  // Calculate collapsed room types count
  const collapsedCount = useMemo(() => {
    return visibleRoomTypes.filter(rt => !expandedRoomTypes.has(rt.id)).length;
  }, [visibleRoomTypes, expandedRoomTypes]);

  return (
      <div className="flex flex-col h-full bg-white">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">

        {/* Legend - Inline */}
        <div className="mt-2 mb-2 flex flex-wrap gap-2 items-center">
          {availabilityOptions.map((option) => {
            const descriptions: Record<string, string> = {
              available: 'Room is available for booking',
              stop_sell: 'Room is blocked from all bookings',
              close_arrival: 'Room cannot be booked for arrival on this day',
              close_departure: 'Room cannot be booked for departure on this day',
              min_stay: 'Minimum stay requirement applies',
              max_stay: 'Maximum stay restriction applies',
            };
            const desc = descriptions[option.id] || 'Availability status';
            
            return (
              <div key={option.id} className="flex items-center gap-1 group relative">
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: option.color, opacity: 0.3 }}
                />
                <span className="text-xs text-slate-600">{option.label}</span>
                <HelpCircle className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                
                {/* Tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2.5 py-1.5 max-w-sm z-[100] break-words text-center">
                  {desc}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-3 border-transparent border-b-slate-900" />
                </div>
              </div>
            );
          })}
          
          {/* CTA & CTD Badges Legend */}
          <div className="h-4 w-px bg-slate-300 mx-1" />
          
          {/* CTA Badge */}
          <div className="flex items-center gap-1 group relative">
            <div className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded border border-orange-300 flex-shrink-0">
              CTA
            </div>
            <HelpCircle className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
            
            {/* CTA Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2.5 py-1.5 max-w-sm z-[100] break-words text-center whitespace-normal">
              <div className="font-semibold mb-1">Close to Arrival</div>
              <div>Room cannot be booked for check-in on this date</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-3 border-transparent border-b-slate-900" />
            </div>
          </div>
          
          {/* CTD Badge */}
          <div className="flex items-center gap-1 group relative">
            <div className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded border border-purple-300 flex-shrink-0">
              CTD
            </div>
            <HelpCircle className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
            
            {/* CTD Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2.5 py-1.5 max-w-sm z-[100] break-words text-center whitespace-normal">
              <div className="font-semibold mb-1">Close to Departure</div>
              <div>Room cannot be booked for check-out on this date</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-3 border-transparent border-b-slate-900" />
            </div>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-300 mx-1" />

          {/* ✅ NEW: Rate Override Badge Legend */}
          <div className="flex items-center gap-1 group relative">
            <div className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-semibold rounded border border-orange-300 flex-shrink-0">
              Rate Override
            </div>
            <HelpCircle className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
            
            {/* Rate Override Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-2.5 py-1.5 max-w-sm z-[100] break-words text-center whitespace-normal">
              <div className="font-semibold mb-1">Price Override Active</div>
              <div>Rate plan price is overridden for this date (shown in orange)</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-3 border-transparent border-b-slate-900" />
            </div>
          </div>
        </div>

        {selectedAvailability.length > 0 && (
          <p className="text-xs text-slate-500">Click • Shift+Click for range • Cmd/Ctrl+Click multi</p>
        )}

        {visibleRoomTypes.length > 1 && (
          <div className="mt-3 flex gap-2">
            {collapsedCount < visibleRoomTypes.length && (
              <button
                onClick={onCollapseAll}
                className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
              >
                Collapse All
              </button>
            )}
            {collapsedCount > 0 && (
              <button
                onClick={onExpandAll}
                className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
              >
                Expand All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Date Navigation Bar */}
      <div className="relative overflow-visible bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
                          <button
                              onClick={onPrevDay}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="Previous Day"
                          >
                              <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                              onClick={onNextDay}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="Next Day"
                          >
                              <ChevronRight className="w-4 h-4" />
                          </button>
                      </div>

                      <div className="flex items-center gap-1">
                          <button
                              onClick={onGoToToday}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                              Today
                          </button>
                          <button
                              onClick={onGoToNextWeek}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                              Next Week
                          </button>
                          <button
                              onClick={onGoToNextMonth}
                              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                          >
                              Next Month
                          </button>
                      </div>
                  </div>

                  <div className="relative flex items-center gap-2">
                    {/* Settings Dropdown Menu */}
                    <div className="relative group">
                      <Button
                        variant="outline"
                        className="h-9 px-3 text-xs font-semibold"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                        <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                      
                      {/* Dropdown Menu */}
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <button
                          onClick={() => {
                            onSettingsTabChange?.('availability');
                            onSettingsOpenChange?.(true);
                          }}
                          className="w-full px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-blue-50 text-left first:rounded-t-lg transition flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          Availability
                        </button>
                        <button
                          onClick={() => {
                            onSettingsTabChange?.('restrictions');
                            onSettingsOpenChange?.(true);
                          }}
                          className="w-full px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-blue-50 text-left transition flex items-center gap-2 border-t border-slate-100"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                          Restrictions
                        </button>
                        <button
                          onClick={() => {
                            onSettingsTabChange?.('rates');
                            onSettingsOpenChange?.(true);
                          }}
                          className="w-full px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-blue-50 text-left last:rounded-b-lg transition flex items-center gap-2 border-t border-slate-100"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                          Rates
                        </button>
                      </div>
                    </div>

                    {/* Date Picker */}
                    <DatePicker
                      value={startDate}
                      onChange={(date) => onStartDateChange?.(date)}
                      placeholder="Pick date"
                    />
                    
                  </div>
      </div>

      {/* Settings Sliding Panel */}
      <>
        {/* Overlay */}
        {showSettingsPanel && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => onSettingsOpenChange?.(false)}
          />
        )}
        
        {/* Sliding Panel */}
        <div
          className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-y-auto ${
            showSettingsPanel ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Panel Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Settings</h3>
              {selectedSettingTab && (
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {selectedSettingTab === 'rates' ? 'Rate Management' : 
                   selectedSettingTab === 'restrictions' ? 'Restrictions & Limits' : 
                   'Availability Management'}
                </p>
              )}
            </div>
            <button
              onClick={() => onSettingsOpenChange?.(false)}
              className="text-slate-400 hover:text-slate-600 transition p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="px-6 py-4">{settingsPanel}</div>
        </div>
      </>
      
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Date Headers */}
          <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
            <div className="w-32 px-4 py-3 bg-slate-50 border-r border-slate-200 font-bold text-sm text-slate-900 flex-shrink-0 sticky left-0 z-20">
              Room Type
            </div>
            {dates.map((date, idx) => (
              <div
                key={idx}
                className="w-24 px-2 py-3 text-center border-r border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 flex-shrink-0"
              >
                {formatDateHeader(date)}
              </div>
            ))}
          </div>

          {/* Room Type Sections */}
          {visibleRoomTypes.map((roomType) => {
            const roomsInType = rooms[roomType.id] || [];
            return (
              <div key={roomType.id}>
                {/* Room Type Header Row */}
                <div className="flex border-b border-slate-200 bg-slate-100 hover:bg-slate-150 group cursor-pointer" onClick={() => onToggleRoomType?.(roomType.id)}>
                  <div className="w-32 px-4 py-3 bg-slate-100 border-r border-slate-200 font-bold text-sm text-slate-900 flex-shrink-0 sticky left-0 z-10 flex items-center gap-2">
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedRoomTypes.has(roomType.id) ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                    {roomType.name}
                  </div>
                  {dates.map((date, idx) => {
                    const defaultRate = getDefaultRate(roomType.id);
                    
                    // Get ALL restrictions that apply to this specific date (min/max, CTA, CTD)
                    const applicableRestrictions = getRestrictionsForDate(roomType, date);
                    
                    // Separate restrictions by type
                    // NOTE: A single restriction record can have BOTH close_to_arrival AND close_to_departure set to true
                    // They are NOT mutually exclusive - you can display both badges
                    const minMaxRestrictions = applicableRestrictions.filter(r => r.min_nights !== null || r.max_nights !== null);
                    const ctaRestriction = applicableRestrictions.find(r => r.close_to_arrival);
                    const ctdRestriction = applicableRestrictions.find(r => r.close_to_departure);
                    
                    // Check if any room has a rate override
                    const hasOverride = hasAnyRoomOverrideForDate(roomType.id, idx);
                    
                    return (
                      <div
                        key={idx}
                        className="w-24 px-2 py-3 border-r border-slate-200 text-center flex-shrink-0 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedRoomTypeForRestriction(roomType);
                          setRestrictionFormData({
                            minNights: minMaxRestrictions.find(r => r.min_nights !== null)?.min_nights || null,
                            maxNights: minMaxRestrictions.find(r => r.max_nights !== null)?.max_nights || null,
                            closeToArrival: !!ctaRestriction,
                            closeToDeparture: !!ctdRestriction,
                            restrictionStartDate: dates[idx],
                            restrictionEndDate: dates[idx],
                          });
                          setRestrictionModalOpen(true);
                        }}
                        title="Click to edit restrictions for this room type"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {/* Display number of units */}
                          <div className="text-sm font-bold text-slate-900">{roomsInType.length} unit{roomsInType.length !== 1 ? 's' : ''}</div>
                          {(minMaxRestrictions.length > 0 || ctaRestriction || ctdRestriction) && (
                            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                              {minMaxRestrictions.map((r, i) => (
                                <div key={i}>
                                  {r.min_nights !== null && <span>Min {r.min_nights}</span>}
                                  {r.min_nights !== null && r.max_nights !== null && <span> • </span>}
                                  {r.max_nights !== null && <span>Max {r.max_nights}</span>}
                                </div>
                              ))}
                              {ctaRestriction && (
                                <div className="text-orange-600 font-semibold">CTA</div>
                              )}
                              {ctdRestriction && (
                                <div className="text-purple-600 font-semibold">CTD</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rates Section (Collapsible) */}
                {expandedRoomTypes.has(roomType.id) && (
                  <div className="flex border-b border-slate-200 bg-blue-50 hover:bg-blue-100 group transition">
                    <div
                      className="w-32 px-4 py-2.5 bg-blue-50 border-r border-slate-200 font-semibold text-xs text-blue-900 flex-shrink-0 sticky left-0 z-10 flex items-center gap-2 cursor-pointer"
                      onClick={() => toggleRatePlans(roomType.id)}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          expandedRatePlans.has(roomType.id) ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span>Rates</span>
                    </div>
                    {dates.map((date, idx) => {
                      const basePrice = getBaseRatePrice(roomType.id, date);
                      const defaultRatePlan = getRatePlansForRoomType(roomType.id).find(rp => rp.default);
                      const override = defaultRatePlan ? getRateOverrideForPlanDate(roomType.id, defaultRatePlan.id, idx) : { hasOverride: false };
                      const displayPrice = override.hasOverride && override.overriddenPrice !== undefined
                        ? override.overriddenPrice
                        : basePrice;
                      
                      return (
                        <div
                          key={idx}
                          className="w-24 px-2 py-2.5 border-r border-slate-200 text-center flex-shrink-0 hover:bg-blue-200 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedRoomTypeForRateEdit(roomType);
                            setEditingRateDateIndex(idx);
                            const currentPrice = override.hasOverride && override.overriddenPrice !== undefined ? override.overriddenPrice : (basePrice || 0);
                            setEditingRateValue(currentPrice.toString());
                            setRateEditStartDate(dates[idx]);
                            setRateEditEndDate(dates[idx]);
                            setRateEditModalOpen(true);
                          }}
                          title="Click to edit rate"
                        >
                          {!expandedRatePlans.has(roomType.id) && displayPrice !== undefined && (
                            <div className="flex flex-col items-center gap-0.5">
                              {override.hasOverride && override.overriddenPrice !== undefined ? (
                                <>
                                  <div className="text-xs font-bold text-orange-600">€{override.overriddenPrice.toFixed(0)}</div>
                                  <div className="text-[10px] text-orange-500 font-semibold">Override</div>
                                </>
                              ) : (
                                <div className="text-xs font-bold text-blue-900">€{displayPrice.toFixed(0)}</div>
                              )}
                            </div>
                          )}
                          {!expandedRatePlans.has(roomType.id) && displayPrice === undefined && (
                            <div className="text-[10px] text-slate-400">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Individual Rate Plan Rows */}
                {expandedRoomTypes.has(roomType.id) && expandedRatePlans.has(roomType.id) && getRatePlansForRoomType(roomType.id).map((ratePlan) => (
                  <div key={ratePlan.id} className="flex border-b border-slate-100 bg-blue-25 hover:bg-blue-50 transition">
                    <div className="w-32 px-4 py-2.5 bg-white border-r border-slate-200 text-xs text-slate-600 font-medium flex-shrink-0 sticky left-0 z-10 flex flex-col items-start gap-1 justify-start overflow-hidden">
                      <span className="break-words text-slate-700 font-semibold leading-tight max-w-full">
                        {ratePlan.planName || ratePlan.id}
                      </span>
                      {ratePlan.default && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    {dates.map((date, dateIdx) => {
                      const override = getRateOverrideForPlanDate(ratePlan.roomTypeId, ratePlan.id, dateIdx);

                      return (
                        <div
                          key={dateIdx}
                          className="w-24 px-2 py-2.5 border-r border-slate-200 text-center flex-shrink-0 hover:bg-orange-100 cursor-pointer transition-colors"
                          onClick={(e) => {
                            // Open rate override modal
                            setSelectedRatePlanForOverride(ratePlan);
                            setSelectedDateIndexForRateOverride(dateIdx);
                            // Pre-fill form with current values
                            if (override.hasOverride) {
                              if (override.overrideType === 'percentage') {
                                setOverrideFormData({
                                  overrideType: 'percentage',
                                  fixedPrice: '',
                                  percentageValue: (override.baseOverrideValue || 0).toString(),
                                  rateOverrideStartDate: dates[dateIdx],
                                  rateOverrideEndDate: dates[dateIdx],
                                });
                              } else {
                                setOverrideFormData({
                                  overrideType: 'fixed',
                                  fixedPrice: (override.overriddenPrice || 0).toString(),
                                  percentageValue: '',
                                  rateOverrideStartDate: dates[dateIdx],
                                  rateOverrideEndDate: dates[dateIdx],
                                });
                              }
                            } else {
                              setOverrideFormData({
                                overrideType: 'fixed',
                                fixedPrice: (ratePlan.basePrice || 0).toString(),
                                percentageValue: '',
                                rateOverrideStartDate: dates[dateIdx],
                                rateOverrideEndDate: dates[dateIdx],
                              });
                            }
                            setRateOverrideModalOpen(true);
                          }}
                          title="Click to edit rate override"
                        >
                          {ratePlan.basePrice !== undefined && (
                            <div className="flex flex-col items-center gap-0.5">
                              {override.hasOverride && override.overriddenPrice !== undefined ? (
                                // ✅ UPDATED: Show ONLY the overridden price during override dates
                                <div className="text-xs font-bold text-orange-600">
                                  €{override.overriddenPrice.toFixed(2)}
                                </div>
                              ) : (
                                // Show base price when no override
                                <div className="text-xs font-semibold text-slate-900">
                                  €{ratePlan.basePrice.toFixed(2)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Individual Room Rows */}
                {expandedRoomTypes.has(roomType.id) && roomsInType.map((room) => {
                  const blockBars = getBlocksForRoom(room.id);
                  const DAY_WIDTH = 96; // w-24 = 96px
                  
                  return (
                  <div key={room.id} className="flex border-b border-slate-100 hover:bg-slate-50 transition relative">
                    <div className="w-32 px-4 py-3 bg-white border-r border-slate-200 text-sm text-slate-700 font-medium flex-shrink-0 sticky left-0 z-10">
                      {room.name}
                    </div>
                    
                    {/* Grid container with position: relative for absolute-positioned block bars */}
                    <div className="relative flex-1" style={{ display: 'flex' }}>
                      {dates.map((date, dateIdx) => {
                        const cellColor = getCellColor(room.id, dateIdx);
                        
                        const isPopoverOpen = popoverState?.roomId === room.id && popoverState?.dateIdx === dateIdx;
                        const currentStatus = availabilityDataMap.get(`${room.id}-${dateToString(date)}`)?.status || 'available';
                        
                        return (
                          <Popover key={dateIdx} open={isPopoverOpen} onOpenChange={(open) => {
                            if (open) {
                              setPopoverState({ roomId: room.id, dateIdx, open: true });
                              // Initialize date range to the clicked cell's date
                              setPopoverDateRange({ start: date, end: date });
                            } else {
                              setPopoverState(null);
                              setPopoverDateRange(null);
                            }
                          }}>
                            <PopoverTrigger asChild>
                              <div
                                className="px-2 py-3 border-r border-slate-200 flex-shrink-0 flex items-center justify-center cursor-pointer"
                                style={{ width: `${DAY_WIDTH}px` }}
                                onClick={(e) => {
                                  // Simply let the popover handle the click
                                  e.stopPropagation();
                                }}
                                onMouseDown={() => onCellDragStart?.(room.id, dateIdx)}
                                onMouseEnter={() => onCellDragOver?.(room.id, dateIdx)}
                                onMouseUp={() => onCellDragEnd?.()}
                              >
                                {/* Show actual status color from Supabase if available */}
                                {cellColor && currentStatus !== 'not_available' ? (
                                  <div
                                    className="w-full h-10 rounded transition-all cursor-pointer border-2 border-transparent opacity-70 hover:opacity-90 flex items-center justify-center font-bold text-xs"
                                    style={{
                                      backgroundColor: cellColor,
                                    }}
                                    title={`${room.name} - ${formatDateHeader(date)}\nClick to toggle availability`}
                                  />
                                ) : selectedColor && selectedAvailability.length > 0 && currentStatus !== 'not_available' ? (
                                  /* Show selection mode if user has selected an availability option and no existing data */
                                  <div
                                    className="w-full h-10 rounded transition-all cursor-pointer border-2 border-transparent opacity-20 hover:opacity-30 flex items-center justify-center font-bold text-xs"
                                    style={{
                                      backgroundColor: selectedColor,
                                    }}
                                    title={`${room.name} - ${formatDateHeader(date)}\nNo availability set • Click to set`}
                                  />
                                ) : (
                                  /* Show empty state when no data and no selection mode */
                                  <div 
                                    className={`w-full h-10 rounded transition-colors border-2 border-transparent cursor-pointer ${currentStatus === 'not_available' ? 'bg-transparent' : 'bg-slate-100 hover:bg-slate-200'}`}
                                    title={currentStatus === 'not_available' ? 'Blocked - Click to see block details' : 'Click to set availability'}
                                  />
                                )}
                              </div>
                            </PopoverTrigger>
                            
                            {/* Popover Content */}
                            <PopoverContent className="w-72 p-4">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold text-sm">{room.name}</h4>
                                  <p className="text-xs text-slate-500">{formatDateHeader(date)}</p>
                                </div>
                                
                                <div className="bg-slate-100 p-2 rounded text-sm">
                                  <p className="text-xs text-slate-600">Current Status:</p>
                                  <p className="font-semibold capitalize">{currentStatus}</p>
                                </div>

                                {/* Date Range Picker */}
                                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                                  <p className="text-xs font-semibold text-slate-700">Block Date Range (optional)</p>
                                  <div className="space-y-2">
                                    <div>
                                      <label className="text-xs text-slate-600">Start Date</label>
                                      <input
                                        type="date"
                                        value={popoverDateRange?.start ? dateToString(popoverDateRange.start) : dateToString(date)}
                                        onChange={(e) => {
                                          const startDate = stringToDate(e.target.value);
                                          setPopoverDateRange(prev => ({
                                            start: startDate,
                                            end: prev?.end && prev.end >= startDate ? prev.end : startDate
                                          }));
                                        }}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-600">End Date</label>
                                      <input
                                        type="date"
                                        value={popoverDateRange?.end ? dateToString(popoverDateRange.end) : dateToString(date)}
                                        onChange={(e) => {
                                          const endDate = stringToDate(e.target.value);
                                          setPopoverDateRange(prev => ({
                                            start: prev?.start || date,
                                            end: endDate
                                          }));
                                        }}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                {currentStatus !== 'not_available' && (
                                  <div className="space-y-2 border-t border-slate-200 pt-3">
                                    <p className="text-xs font-semibold text-slate-700">Block Reason</p>
                                    <select
                                      value={selectedReason}
                                      onChange={(e) => setSelectedReason(e.target.value)}
                                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                                    >
                                      <option value="maintenance">🔧 Maintenance</option>
                                      <option value="owner_stay">👤 Owner Stay</option>
                                      <option value="stop_sell">🛑 Stop Sell</option>
                                      <option value="out_of_service">⚠️ Out of Service</option>
                                      <option value="other">❓ Other (specify below)</option>
                                    </select>

                                    <div>
                                      <label className="text-xs text-slate-600">
                                        {selectedReason === 'other' ? 'Custom Reason *' : 'Notes (optional)'}
                                      </label>
                                      <textarea
                                        value={reasonNotes}
                                        onChange={(e) => setReasonNotes(e.target.value)}
                                        placeholder={selectedReason === 'other' ? 'Enter custom reason...' : 'Add optional notes...'}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs resize-none"
                                        rows={2}
                                      />
                                    </div>
                                  </div>
                                )}
                                
                                <div className="space-y-2">
                                  {currentStatus === 'not_available' ? (
                                    <>
                                      <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-800">
                                        🔒 This date range is blocked (Stop Sell)
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteBlock(room.id, date)}
                                        disabled={isUpdatingCell}
                                        className="w-full text-xs text-red-600 hover:text-red-700"
                                      >
                                        🔓 Remove Block (Open for Bookings)
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        handleRoomAvailabilityToggle(room.id, roomType.id, dateIdx, popoverDateRange || undefined);
                                      }}
                                      disabled={isUpdatingCell}
                                      className="w-full text-xs"
                                    >
                                      Block Dates (Stop Sell)
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                      
                      {/* Block Bars - Rendered on top of grid as absolute overlays */}
                      {blockBars.map((block, idx) => {
                        const leftPosition = block.startDateIndex * DAY_WIDTH;
                        const barWidth = (block.endDateIndex - block.startDateIndex + 1) * DAY_WIDTH;
                        const isBlockPopoverOpen = blockPopoverState?.roomId === room.id && blockPopoverState?.blockIndex === idx;
                        
                        return (
                          <Popover key={`block-${idx}`} open={isBlockPopoverOpen} onOpenChange={(open) => {
                            if (open) {
                              setBlockPopoverState({ roomId: room.id, roomTypeId: roomType.id, blockIndex: idx, open: true });
                              setIsEditingBlock(false);
                              setBlockEditingData({ startDate: block.startDate, endDate: block.endDate });
                            } else {
                              setBlockPopoverState(null);
                              setIsEditingBlock(false);
                              setBlockEditingData(null);
                            }
                          }}>
                            <PopoverTrigger asChild>
                              <div style={{ position: 'absolute', left: `${leftPosition}px`, width: `${barWidth - 4}px`, top: '0.5rem', height: 'calc(100% - 1rem)' }}>
                                <BlockBar
                                  roomId={room.id}
                                  roomName={room.name}
                                  startDate={block.startDate}
                                  endDate={block.endDate}
                                  reason={block.reason}
                                  reason_details={block.reason_details}
                                  notes={block.notes}
                                  onBlockClick={() => {
                                    setBlockPopoverState({ roomId: room.id, roomTypeId: roomType.id, blockIndex: idx, open: true });
                                  }}
                                  style={{ position: 'relative', left: 0, width: '100%', top: 0 }}
                                />
                              </div>
                            </PopoverTrigger>
                            
                            {/* Block Management Dropdown */}
                            <PopoverContent className="w-80 p-4 z-50">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-sm">{room.name}</h4>
                                  <p className="text-xs text-slate-500">
                                    {block.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                    {block.startDate.getTime() !== block.endDate.getTime() && (
                                      <> - {block.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                                    )}
                                  </p>
                                </div>

                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-red-900">🔒 Stop Sell Block Active</p>
                                  <p className="text-xs text-red-800 mt-1">This date range is blocked from all bookings</p>
                                </div>

                                {!isEditingBlock ? (
                                  // View Mode - Show options
                                  <div className="space-y-2">
                                    {/* Reason & Details Display */}
                                    <div className="bg-slate-50 rounded-lg p-2 text-xs space-y-1">
                                      <div>
                                        <p className="font-semibold text-slate-700">Reason:</p>
                                        <p className="text-slate-600">
                                          {blockReason === 'maintenance' && '🔧 Maintenance'}
                                          {blockReason === 'owner_stay' && '👤 Owner Stay'}
                                          {blockReason === 'stop_sell' && '🛑 Stop Sell'}
                                          {blockReason === 'out_of_service' && '⚠️ Out of Service'}
                                          {blockReason === 'other' && '❓ Other'}
                                          {!blockReason && 'Not specified'}
                                        </p>
                                      </div>
                                      {blockReason === 'other' && blockReasonDetails && (
                                        <div>
                                          <p className="font-semibold text-slate-700">Custom Reason:</p>
                                          <p className="text-slate-600 break-words">{blockReasonDetails}</p>
                                        </div>
                                      )}
                                      {block.notes && (
                                        <div>
                                          <p className="font-semibold text-slate-700">Notes:</p>
                                          <p className="text-slate-600 break-words">{block.notes}</p>
                                        </div>
                                      )}
                                    </div>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setIsEditingBlock(true)}
                                      disabled={isUpdatingCell}
                                      className="w-full text-xs"
                                    >
                                      ✏️ Edit Block Dates
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteBlock(room.id, block.startDate)}
                                      disabled={isUpdatingCell}
                                      className="w-full text-xs"
                                    >
                                      🗑️ Remove Block Entirely
                                    </Button>
                                  </div>
                                ) : (
                                  // Edit Mode - Show date pickers
                                  <div className="space-y-3 border-t border-slate-200 pt-3">
                                    <p className="text-xs font-semibold text-slate-700">Modify Date Range</p>
                                    <div className="space-y-2">
                                      <div>
                                        <label className="text-xs text-slate-600">Start Date</label>
                                        <input
                                          type="date"
                                          value={dateToString(blockEditingData?.startDate || block.startDate)}
                                          onChange={(e) => {
                                            const newStart = stringToDate(e.target.value);
                                            setBlockEditingData(prev => ({
                                              startDate: newStart,
                                              endDate: prev?.endDate && prev.endDate >= newStart ? prev.endDate : newStart
                                            }));
                                          }}
                                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-600">End Date</label>
                                        <input
                                          type="date"
                                          value={dateToString(blockEditingData?.endDate || block.endDate)}
                                          onChange={(e) => {
                                            const newEnd = stringToDate(e.target.value);
                                            setBlockEditingData(prev => ({
                                              startDate: prev?.startDate || block.startDate,
                                              endDate: newEnd
                                            }));
                                          }}
                                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                        />
                                      </div>
                                    </div>

                                    <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-800">
                                      ℹ️ Days removed from the block will become available for booking
                                    </div>

                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setIsEditingBlock(false);
                                          setBlockEditingData({ startDate: block.startDate, endDate: block.endDate });
                                        }}
                                        disabled={isUpdatingCell}
                                        className="flex-1 text-xs"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleEditBlock}
                                        disabled={isUpdatingCell}
                                        className="flex-1 text-xs"
                                      >
                                        Save Changes
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}

          {/* Empty State */}
          {visibleRoomTypes.length === 0 && (
            <div className="flex items-center justify-center h-48 text-slate-500">
              <p className="text-sm">No room data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Restriction Modal */}
      {restrictionModalOpen && selectedRoomTypeForRestriction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selectedRoomTypeForRestriction.name} - Restrictions</h3>
              <button
                onClick={() => {
                  setRestrictionModalOpen(false);
                  setSelectedRoomTypeForRestriction(null);
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={dateToString(restrictionFormData.restrictionStartDate)}
                    onChange={(e) =>
                      setRestrictionFormData({
                        ...restrictionFormData,
                        restrictionStartDate: stringToDate(e.target.value),
                      })
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                  <span className="text-slate-600">→</span>
                  <input
                    type="date"
                    value={dateToString(restrictionFormData.restrictionEndDate)}
                    onChange={(e) =>
                      setRestrictionFormData({
                        ...restrictionFormData,
                        restrictionEndDate: stringToDate(e.target.value),
                      })
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Min Nights */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Min Nights
                </label>
                <input
                  type="number"
                  min="0"
                  value={restrictionFormData.minNights || ''}
                  onChange={(e) =>
                    setRestrictionFormData({
                      ...restrictionFormData,
                      minNights: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="No limit"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>

              {/* Max Nights */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Max Nights
                </label>
                <input
                  type="number"
                  min="0"
                  value={restrictionFormData.maxNights || ''}
                  onChange={(e) =>
                    setRestrictionFormData({
                      ...restrictionFormData,
                      maxNights: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="No limit"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restrictionFormData.closeToArrival}
                    onChange={(e) =>
                      setRestrictionFormData({
                        ...restrictionFormData,
                        closeToArrival: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700">Close to Arrival (CTA)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restrictionFormData.closeToDeparture}
                    onChange={(e) =>
                      setRestrictionFormData({
                        ...restrictionFormData,
                        closeToDeparture: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700">Close to Departure (CTD)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setRestrictionModalOpen(false);
                    setSelectedRoomTypeForRestriction(null);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRestrictions}
                  disabled={isUpdatingRestriction}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {isUpdatingRestriction ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Edit Modal */}
      {rateEditModalOpen && selectedRoomTypeForRateEdit && editingRateDateIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Edit Rate</h3>
              <button
                onClick={() => {
                  setRateEditModalOpen(false);
                  setSelectedRoomTypeForRateEdit(null);
                  setEditingRateValue('');
                  setEditingRateDateIndex(null);
                  setRateEditStartDate(new Date());
                  setRateEditEndDate(new Date());
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={dateToString(rateEditStartDate)}
                    onChange={(e) =>
                      setRateEditStartDate(stringToDate(e.target.value))
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                  <span className="text-slate-600">→</span>
                  <input
                    type="date"
                    value={dateToString(rateEditEndDate)}
                    onChange={(e) =>
                      setRateEditEndDate(stringToDate(e.target.value))
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Room Type Info */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Room Type: {selectedRoomTypeForRateEdit.name}
                </label>
              </div>

              {/* Price Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingRateValue}
                  onChange={(e) => setEditingRateValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  autoFocus
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setRateEditModalOpen(false);
                    setSelectedRoomTypeForRateEdit(null);
                    setEditingRateValue('');
                    setEditingRateDateIndex(null);
                    setRateEditStartDate(new Date());
                    setRateEditEndDate(new Date());
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDefaultRate}
                  disabled={isUpdatingRate}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {isUpdatingRate ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Override Modal */}
      {rateOverrideModalOpen && selectedRatePlanForOverride && selectedDateIndexForRateOverride !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Rate Override</h3>
              <button
                onClick={() => {
                  setRateOverrideModalOpen(false);
                  setSelectedRatePlanForOverride(null);
                  setSelectedDateIndexForRateOverride(null);
                  setOverrideFormData({ overrideType: 'fixed', fixedPrice: '', percentageValue: '', rateOverrideStartDate: new Date(), rateOverrideEndDate: new Date() });
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={dateToString(overrideFormData.rateOverrideStartDate)}
                    onChange={(e) =>
                      setOverrideFormData({
                        ...overrideFormData,
                        rateOverrideStartDate: stringToDate(e.target.value),
                      })
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                  <span className="text-slate-600">→</span>
                  <input
                    type="date"
                    value={dateToString(overrideFormData.rateOverrideEndDate)}
                    onChange={(e) =>
                      setOverrideFormData({
                        ...overrideFormData,
                        rateOverrideEndDate: stringToDate(e.target.value),
                      })
                    }
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Rate Plan and Date Info */}
              <div className="bg-slate-50 p-3 rounded">
                <div className="text-xs text-slate-600">
                  <div><strong>Rate Plan:</strong> {selectedRatePlanForOverride.planName || selectedRatePlanForOverride.id}</div>
                  <div><strong>Base Price:</strong> €{(selectedRatePlanForOverride.basePrice || 0).toFixed(2)}</div>
                </div>
              </div>

              {/* Override Type Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Override Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setOverrideFormData({ ...overrideFormData, overrideType: 'fixed' })
                    }
                    className={`flex-1 px-3 py-2 rounded font-medium transition-colors ${
                      overrideFormData.overrideType === 'fixed'
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Fixed Price
                  </button>
                  <button
                    onClick={() =>
                      setOverrideFormData({ ...overrideFormData, overrideType: 'percentage' })
                    }
                    className={`flex-1 px-3 py-2 rounded font-medium transition-colors ${
                      overrideFormData.overrideType === 'percentage'
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Add %
                  </button>
                </div>
              </div>

              {/* Fixed Price Input */}
              {overrideFormData.overrideType === 'fixed' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fixed Price (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={overrideFormData.fixedPrice}
                    onChange={(e) =>
                      setOverrideFormData({ ...overrideFormData, fixedPrice: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    autoFocus
                  />
                  {overrideFormData.fixedPrice && !isNaN(parseFloat(overrideFormData.fixedPrice)) && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-900">
                      <strong>Final Price:</strong> €{parseFloat(overrideFormData.fixedPrice).toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {/* Percentage Input */}
              {overrideFormData.overrideType === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Add Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={overrideFormData.percentageValue}
                    onChange={(e) =>
                      setOverrideFormData({ ...overrideFormData, percentageValue: e.target.value })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    autoFocus
                  />
                  {overrideFormData.percentageValue && !isNaN(parseFloat(overrideFormData.percentageValue)) && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-900">
                      <div>
                        <strong>Markup:</strong> {parseFloat(overrideFormData.percentageValue) >= 0 ? '+' : ''}
                        {parseFloat(overrideFormData.percentageValue).toFixed(0)}%
                      </div>
                      <div>
                        <strong>Final Price:</strong> €
                        {(
                          (selectedRatePlanForOverride.basePrice || 0) *
                          (1 + parseFloat(overrideFormData.percentageValue) / 100)
                        ).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setRateOverrideModalOpen(false);
                    setSelectedRatePlanForOverride(null);
                    setSelectedDateIndexForRateOverride(null);
                    setOverrideFormData({ overrideType: 'fixed', fixedPrice: '', percentageValue: '', rateOverrideStartDate: new Date(), rateOverrideEndDate: new Date() });
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRateOverride}
                  disabled={isUpdatingRateOverride}
                  className="flex-1 px-3 py-2 bg-orange-600 text-white rounded font-medium hover:bg-orange-700 disabled:bg-orange-400 transition-colors"
                >
                  {isUpdatingRateOverride ? 'Saving...' : 'Save Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && pendingAction && pendingCellData && (
        <ConfirmationModal
          isOpen={showConfirmationModal}
          action={pendingAction}
          selectedCells={
            new Map([
              [pendingCellData.roomId, new Set([pendingCellData.dateIdx])]
            ])
          }
          rooms={rooms}
          roomTypes={roomTypes}
          dates={dates}
          onConfirm={handleConfirmCellAction}
          onCancel={() => {
            setShowConfirmationModal(false);
            setPendingAction(null);
            setPendingCellData(null);
          }}
          pendingCellData={pendingCellData}
          setPendingCellData={setPendingCellData}
          isLoading={false}
        />
      )}
    </div>
  );
}

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean;
  action: 'available' | 'stop_sell';
  selectedCells: Map<string, Set<number>>;
  rooms: RoomsObject;
  roomTypes: RoomType[];
  dates: Date[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  pendingCellData?: { roomId: string; dateIdx: number; roomType: RoomType; startDate: Date; endDate: Date } | null;
  setPendingCellData?: (data: any) => void;
}

function ConfirmationModal({
  isOpen,
  action,
  selectedCells,
  rooms,
  roomTypes,
  dates,
  onConfirm,
  onCancel,
  isLoading,
  pendingCellData,
  setPendingCellData,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  // Group selected rooms by room type
  const roomsByType = new Map<string, Array<{ roomId: string; name: string }>>();
  const dateRangesByRoom = new Map<string, Array<{ startDate: string; endDate: string }>>();

  // Process selected cells
  for (const [roomId, dateIndices] of selectedCells) {
    // Find room type and name
    let roomTypeName = '';
    let roomName = '';
    for (const [roomTypeId, roomList] of Object.entries(rooms)) {
      const room = roomList.find(r => r.id === roomId);
      if (room) {
        roomTypeName = roomTypeId;
        roomName = room.name;
        break;
      }
    }

    if (roomTypeName) {
      if (!roomsByType.has(roomTypeName)) {
        roomsByType.set(roomTypeName, []);
      }
      roomsByType.get(roomTypeName)!.push({ roomId, name: roomName });

      // Convert date indices to ranges
      const sortedIndices = Array.from(dateIndices).sort((a, b) => a - b);
      const ranges: Array<{ startDate: string; endDate: string }> = [];
      let rangeStart = sortedIndices[0];
      let rangeEnd = sortedIndices[0];

      for (let i = 1; i < sortedIndices.length; i++) {
        if (sortedIndices[i] === rangeEnd + 1) {
          rangeEnd = sortedIndices[i];
        } else {
          ranges.push({
            startDate: dateToString(dates[rangeStart]),
            endDate: dateToString(dates[rangeEnd]),
          });
          rangeStart = sortedIndices[i];
          rangeEnd = sortedIndices[i];
        }
      }
      ranges.push({
        startDate: dateToString(dates[rangeStart]),
        endDate: dateToString(dates[rangeEnd]),
      });

      dateRangesByRoom.set(roomId, ranges);
    }
  }

  const totalRooms = selectedCells.size;
  const totalDateRanges = Array.from(selectedCells.values()).reduce(
    (sum, indices) => sum + (Array.from(indices).length > 0 ? 1 : 0),
    0
  );

  const actionLabel = action === 'available' ? 'Set Available' : 'Stop Sell';
  const actionDescription = action === 'available' 
    ? 'mark these rooms as available' 
    : 'mark these rooms as not available (Stop Sell)';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Confirm Availability Change</h2>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Action Summary */}
          <div className={`rounded-lg p-4 border ${action === 'available' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'}`}>
            <p className={`font-semibold ${action === 'available' 
              ? 'text-green-900' 
              : 'text-red-900'}`}>
              You are about to {actionDescription} for:
            </p>
            <ul className={`text-sm mt-2 space-y-1 ${action === 'available' 
              ? 'text-green-800' 
              : 'text-red-800'}`}>
              <li>• {totalRooms} room{totalRooms !== 1 ? 's' : ''}</li>
              <li>• {totalDateRanges} date range{totalDateRanges !== 1 ? 's' : ''}</li>
            </ul>
          </div>

          {/* Date Range - Only for single cell clicks */}
          {pendingCellData && (
            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Date Range
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={dateToString(pendingCellData.startDate)}
                  onChange={(e) => {
                    setPendingCellData?.({
                      ...pendingCellData,
                      startDate: stringToDate(e.target.value),
                    });
                  }}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                />
                <span className="text-slate-600">→</span>
                <input
                  type="date"
                  value={dateToString(pendingCellData.endDate)}
                  onChange={(e) => {
                    setPendingCellData?.({
                      ...pendingCellData,
                      endDate: stringToDate(e.target.value),
                    });
                  }}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
          )}

          {/* Rooms by Type */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Rooms by Type:</h3>
            {Array.from(roomsByType.entries()).map(([roomTypeId, roomsInType]) => (
              <div key={roomTypeId} className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-3">{roomTypeId}</h4>
                <div className="space-y-2 ml-4">
                  {roomsInType.map((room) => (
                    <div key={room.roomId} className="space-y-1">
                      <p className="text-sm font-medium text-slate-700">{room.name}</p>
                      <div className="ml-2 text-xs text-slate-600 space-y-0.5">
                        {dateRangesByRoom.get(room.roomId)?.map((range, idx) => (
                          <div key={idx}>
                            {range.startDate === range.endDate
                              ? range.startDate
                              : `${range.startDate} to ${range.endDate}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-2 text-white rounded font-medium transition-colors ${
              action === 'available'
                ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
                : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
            }`}
          >
            {isLoading ? 'Saving...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
