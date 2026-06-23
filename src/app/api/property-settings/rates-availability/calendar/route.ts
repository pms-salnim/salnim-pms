import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface AvailabilityRecord {
  room_id: string;
  date: string;
  end_date: string | null;
  status: string;
  occupancy?: number;
  notes?: string;
  reason?: string | null;
  reason_details?: string | null;
  min_nights?: number | null;
  max_nights?: number | null;
  close_to_arrival?: boolean;
  close_to_departure?: boolean;
  // Days-of-week filtering (0-6: Mon-Sun, null = all days)
  applied_days?: number[] | null;
  // Rate override fields (now stored at room_type + rate_plan level)
  override_type?: string | null;
  override_value?: number | null;
  derive_pricing?: boolean;
  rate_plan_ids?: string[];
  room_type_id?: string;  // ✅ NEW: Room type ID for rate overrides
}

interface ExpandedAvailability extends AvailabilityRecord {
  date: string;
}

interface RateOverrideRecord {
  room_type_id: string;
  date: string;
  end_date: string | null;
  override_type: string | null;
  override_value: number | null;
  rate_plan_ids: string[];
  applied_days?: number[] | null;
}

/**
 * GET /api/property-settings/rates-availability/calendar
 * Fetches availability data from three tables:
 * - availability_calendar: core availability status
 * - availability_restrictions: min/max stay, CTA, CTD (at room_type level)
 * - rate_overrides: rate override data (at room_type + rate_plan level)
 * 
 * Query Parameters:
 * - propertyId (required): Property ID
 * - minDate (required): Start date (YYYY-MM-DD)
 * - maxDate (required): End date (YYYY-MM-DD)
 * - roomIds (optional): Comma-separated room IDs
 * - roomTypeIds (optional): Comma-separated room type IDs (for rate lookups)
 */

// ✅ Helper: Detect schema/relation errors for retry logic
function isSchemaOrRelationError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('relationship') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

// ✅ Helper: Detect if a table is completely missing
function isMissingTableError(error: any, table: string): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes(`relation \"public.${table.toLowerCase()}\" does not exist`) ||
    message.includes(`relation \"${table.toLowerCase()}\" does not exist`) ||
    message.includes(`could not find the table 'public.${table.toLowerCase()}'`)
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const minDate = searchParams.get('minDate');
    const maxDate = searchParams.get('maxDate');
    const roomIdsParam = searchParams.get('roomIds');
    const roomTypeIdsParam = searchParams.get('roomTypeIds');

    console.log('[Calendar API] Request params:', { propertyId, minDate, maxDate, roomIdsCount: roomIdsParam?.split(',').length, roomTypeIdsCount: roomTypeIdsParam?.split(',').length });

    if (!propertyId || !minDate || !maxDate) {
      return NextResponse.json(
        { error: 'propertyId, minDate, and maxDate are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const roomIds = roomIdsParam ? roomIdsParam.split(',') : [];
    const roomTypeIds = roomTypeIdsParam ? roomTypeIdsParam.split(',') : [];

    // ✅ HELPER: Check if a date's day-of-week is in the appliedDays array
    // appliedDays: [0,1,2,3,4] = Mon-Fri, [5,6] = Sat-Sun, null/[] = all days
    const isDateApplicable = (dateStr: string, appliedDays: number[] | null): boolean => {
      // If no applied_days specified, it applies to all days
      if (!appliedDays || appliedDays.length === 0) return true;
      
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      // Convert JS day (0=Sunday) to our format (0=Monday)
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return appliedDays.includes(dayIndex);
    };

    // ✅ NEW: Fetch room type mapping from rooms table
    console.log('[Calendar API] Fetching room -> room_type mapping...');
    let roomMappingQuery = supabase
      .from('rooms')
      .select('id, room_type_id')
      .eq('property_id', propertyId);

    if (roomIds.length > 0) {
      roomMappingQuery = roomMappingQuery.in('id', roomIds);
    }

    let { data: roomMappingData, error: roomMappingError } = await roomMappingQuery;
    console.log('[Calendar API] Room mapping result:', { count: roomMappingData?.length, error: roomMappingError?.message });
    if (roomMappingError && isSchemaOrRelationError(roomMappingError)) {
      console.warn('[Calendar API] Room mapping has schema error, retrying simple select...');
      const fallback = await supabase.from('rooms').select('id, room_type_id').eq('property_id', propertyId);
      roomMappingData = fallback.data || [];
      roomMappingError = fallback.error;
    }
    if (isMissingTableError(roomMappingError, 'rooms')) {
      console.warn('[Calendar API] Rooms table missing, proceeding with empty room mapping');
      roomMappingData = [];
      roomMappingError = null;
    } else if (roomMappingError) {
      console.error('[Calendar API] Room mapping error:', roomMappingError);
      throw roomMappingError;
    }

    // Build room -> roomType mapping
    const roomToRoomTypeMap = new Map<string, string>();
    (roomMappingData ?? []).forEach(room => {
      if (room.id && room.room_type_id) {
        roomToRoomTypeMap.set(room.id, room.room_type_id);
      }
    });
    console.log('[Calendar API] Room to RoomType mapping created:', roomToRoomTypeMap.size);

    // Fetch availability_calendar data (core availability)
    console.log('[Calendar API] Fetching availability_calendar...');
    let availQuery = supabase
      .from('availability_calendar')
      .select('room_id, room_type_id, date, end_date, status, occupancy, notes, reason, reason_details, applied_days')
      .eq('property_id', propertyId)
      .lte('date', maxDate)
      .order('date', { ascending: true })  // ✅ Order by start date ascending
      .order('end_date', { ascending: true });  // ✅ Then by end date (shorter ranges first)

    if (roomIds.length > 0) {
      availQuery = availQuery.in('room_id', roomIds);
    }

    let { data: availData, error: availError } = await availQuery;
    console.log('[Calendar API] 📥 Raw availability result:', { count: availData?.length, error: availError?.message });
    if (availError && isSchemaOrRelationError(availError)) {
      console.warn('[Calendar API] Availability query has schema error, retrying simple select...');
      const fallback = await supabase
        .from('availability_calendar')
        .select('room_id, date, status')
        .eq('property_id', propertyId)
        .lte('date', maxDate);
      availData = fallback.data || [];
      availError = fallback.error;
    }
    if (isMissingTableError(availError, 'availability_calendar')) {
      console.warn('[Calendar API] Availability calendar table missing, proceeding with empty availability');
      availData = [];
      availError = null;
    } else if (availError) {
      console.error('[Calendar API] Availability error:', availError);
      throw availError;
    }
    // Log sample of raw availability data
    if (availData && availData.length > 0) {
      console.log('[Calendar API] 🔍 Sample RAW availability records (before merge):', availData.slice(0, 3).map(r => ({
        room_id: r.room_id,
        room_type_id: r.room_type_id,
        date: r.date,
        end_date: r.end_date,
        status: r.status
      })));
    }

    // Normalize availability records to room-level.
    // Some records are stored at room_type level (room_id is null); expand those
    // to every physical room in that room type so room availability counts are accurate.
    const roomIdsByType = new Map<string, string[]>();
    (roomMappingData ?? []).forEach((room) => {
      if (!room?.id || !room?.room_type_id) return;
      if (!roomIdsByType.has(room.room_type_id)) {
        roomIdsByType.set(room.room_type_id, []);
      }
      roomIdsByType.get(room.room_type_id)!.push(room.id);
    });

    const normalizedAvailData: AvailabilityRecord[] = [];
    (availData ?? []).forEach((record: any) => {
      if (record.room_id) {
        normalizedAvailData.push({
          room_id: record.room_id,
          room_type_id: record.room_type_id || roomToRoomTypeMap.get(record.room_id),
          date: record.date,
          end_date: record.end_date,
          status: record.status,
          occupancy: record.occupancy,
          notes: record.notes,
          reason: record.reason,
          reason_details: record.reason_details,
          applied_days: record.applied_days,
        });
        return;
      }

      const recordRoomTypeId = record.room_type_id;
      if (!recordRoomTypeId) return;

      const roomsInType = roomIdsByType.get(recordRoomTypeId) || [];
      roomsInType.forEach((roomId) => {
        normalizedAvailData.push({
          room_id: roomId,
          room_type_id: recordRoomTypeId,
          date: record.date,
          end_date: record.end_date,
          status: record.status,
          occupancy: record.occupancy,
          notes: record.notes,
          reason: record.reason,
          reason_details: record.reason_details,
          applied_days: record.applied_days,
        });
      });
    });

    console.log('[Calendar API] ✅ Normalized room-level availability records:', normalizedAvailData.length);

    // Fetch availability_restrictions data (now uses room_type_id instead of room_id)
    console.log('[Calendar API] Fetching availability_restrictions by room_type...');
    let restrictQuery = supabase
      .from('availability_restrictions')
      .select('id, room_id, room_type_id, date, end_date, min_nights, max_nights, close_to_arrival, close_to_departure, applied_days')
      .eq('property_id', propertyId)
      .gte('date', minDate)  // ✅ NEW: Only fetch restrictions within date range
      .lte('date', maxDate)
      .not('room_type_id', 'is', null)  // ✅ UPDATED: Query by room_type_id instead of room_id
      .order('id', { ascending: false });  // ✅ NEW: Order by ID descending to get most recent first

    if (roomTypeIds.length > 0) {
      restrictQuery = restrictQuery.in('room_type_id', roomTypeIds);  // ✅ UPDATED: Filter by room_type_id
    }

    let { data: restrictData, error: restrictError } = await restrictQuery;
    console.log('[Calendar API] Restrictions result:', { count: restrictData?.length, error: restrictError?.message });
    if (restrictError && isSchemaOrRelationError(restrictError)) {
      console.warn('[Calendar API] Restrictions query has schema error, retrying with minimal columns...');
      const fallback = await supabase
        .from('availability_restrictions')
        .select('*')
        .eq('property_id', propertyId)
        .limit(0); // Try minimal query just to check if table exists
      restrictData = fallback.data || [];
      restrictError = fallback.error;
    }
    if (isMissingTableError(restrictError, 'availability_restrictions') || (restrictError && restrictError.message?.includes('does not exist'))) {
      console.warn('[Calendar API] Availability restrictions table has schema issues, proceeding with empty restrictions');
      restrictData = [];
      restrictError = null;
    } else if (restrictError) {
      console.error('[Calendar API] Restrictions error:', restrictError);
      throw restrictError;
    }

    // Fetch rate_overrides data (now uses room_type_id instead of room_id)
    // ✅ NOTE: We fetch ALL rates for the property, not just within the visible date range
    // This allows rate overrides to persist even when navigating to different dates
    console.log('[Calendar API] Fetching ALL rate_overrides by room_type...');
    let rateQuery = supabase
      .from('rate_overrides')
      .select('id, room_type_id, date, end_date, override_type, override_value, derive_pricing, rate_plan_ids, applied_days')
      .eq('property_id', propertyId)
      .not('room_type_id', 'is', null)
      .order('id', { ascending: false });  // ✅ NEW: Order by ID descending to get most recent first

    if (roomTypeIds.length > 0) {
      rateQuery = rateQuery.in('room_type_id', roomTypeIds);
    }

    let { data: rateData, error: rateError } = await rateQuery;
    console.log('[Calendar API] Rates result:', { count: rateData?.length, error: rateError?.message });
    if (rateError && isSchemaOrRelationError(rateError)) {
      console.warn('[Calendar API] Rates query has schema error, retrying with minimal columns...');
      const fallback = await supabase
        .from('rate_overrides')
        .select('*')
        .eq('property_id', propertyId)
        .limit(0); // Try minimal query just to check if table exists
      rateData = fallback.data || [];
      rateError = fallback.error;
    }
    if (isMissingTableError(rateError, 'rate_overrides') || (rateError && rateError.message?.includes('does not exist'))) {
      console.warn('[Calendar API] Rate overrides table has schema issues, proceeding with empty rates');
      rateData = [];
      rateError = null;
    } else if (rateError) {
      console.error('[Calendar API] Rates error:', rateError);
      throw rateError;
    }

    // Fetch reservations to block already-booked rooms in this date window.
    // This prevents overbooking when availability is consumed directly from this API.
    console.log('[Calendar API] Fetching overlapping reservations for occupancy blocking...');
    let reservationsQuery = supabase
      .from('reservations')
      .select('id, status, start_date, end_date, rooms_data')
      .eq('property_id', propertyId)
      .lte('start_date', maxDate)
      .gt('end_date', minDate)
      .order('start_date', { ascending: true });

    let { data: reservationsData, error: reservationsError } = await reservationsQuery;
    console.log('[Calendar API] Reservations result:', { count: reservationsData?.length, error: reservationsError?.message });
    if (reservationsError && isSchemaOrRelationError(reservationsError)) {
      console.warn('[Calendar API] Reservations query has schema error, retrying simple select...');
      const fallback = await supabase
        .from('reservations')
        .select('id, start_date, end_date')
        .eq('property_id', propertyId)
        .lte('start_date', maxDate);
      reservationsData = fallback.data || [];
      reservationsError = fallback.error;
    }
    if (isMissingTableError(reservationsError, 'reservations')) {
      console.warn('[Calendar API] Reservations table missing, proceeding with empty reservations');
      reservationsData = [];
      reservationsError = null;
    } else if (reservationsError) {
      console.error('[Calendar API] Reservations error:', reservationsError);
      throw reservationsError;
    }

    // Build a map for efficient lookups
    // ✅ UPDATED: Key: `${room_type_id}|${date}` for restrictions (was room_id)
    const restrictionMap = new Map();
    (restrictData ?? []).forEach(record => {
      const key = `${record.room_type_id}|${record.date}`;
      // Since query is ordered by ID descending, first record for each key is the most recent
      if (!restrictionMap.has(key)) {
        restrictionMap.set(key, record);
      }
    });

    // ✅ UPDATED: Build rate map with separate entries for EACH rate plan
    // Key: `${room_type_id}|${date}|${rate_plan_id}` -> override data for that specific rate plan
    // This ensures each rate plan gets its own override_value, not a merged value
    const rateMap = new Map<string, any>();
    
    (rateData ?? []).forEach(record => {
      const recordRatePlanIds = Array.isArray(record.rate_plan_ids)
        ? record.rate_plan_ids
        : (typeof record.rate_plan_ids === 'string' ? JSON.parse(record.rate_plan_ids) : []);
      
      // Create a separate map entry for EACH rate plan in this record
      recordRatePlanIds.forEach((ratePlanId: string) => {
        const key = `${record.room_type_id}|${record.date}|${ratePlanId}`;
        // Keep only the most recent record per rate plan (first in descending ID order)
        if (!rateMap.has(key)) {
          rateMap.set(key, record);
        }
      });
    });

    console.log('[Calendar API] Maps created:', { restrictionMapSize: restrictionMap.size, rateMapSize: rateMap.size });

    // Build reservation-derived blocked records (room-level, checkout-exclusive)
    const reservationBlockedRecords: AvailabilityRecord[] = [];
    const inactiveStatuses = new Set(['canceled', 'cancelled', 'no-show', 'completed']);
    const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

    (reservationsData ?? []).forEach((reservation: any) => {
      const reservationStatus = String(reservation.status || '').toLowerCase();
      if (inactiveStatuses.has(reservationStatus)) return;

      const start = new Date(reservation.start_date);
      const end = new Date(reservation.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      // Reservation end_date is checkout date (exclusive for occupied nights)
      end.setDate(end.getDate() - 1);

      const searchStart = new Date(minDate);
      const searchEnd = new Date(maxDate);

      const blockedStart = start > searchStart ? start : searchStart;
      const blockedEnd = end < searchEnd ? end : searchEnd;

      if (blockedStart > blockedEnd) return;

      const roomEntries = Array.isArray(reservation.rooms_data) ? reservation.rooms_data : [];
      roomEntries.forEach((roomEntry: any) => {
        const roomId = roomEntry?.roomId;
        if (!roomId) return;

        reservationBlockedRecords.push({
          room_id: roomId,
          date: toIsoDate(blockedStart),
          end_date: toIsoDate(blockedEnd),
          status: 'blocked',
          reason: 'occupied',
          reason_details: `Occupied by reservation ${reservation.id}`,
          applied_days: null,
          occupancy: 1,
        });
      });
    });

    console.log('[Calendar API] Reservation blocked records:', reservationBlockedRecords.length);

    // Merge data: start with availability, add restrictions (but NOT rates - they're returned separately)
    const mergedRecords = normalizedAvailData.map((avail, index) => {
      // ✅ NEW: Look up room type for this room first
      const roomTypeId = avail.room_type_id || roomToRoomTypeMap.get(avail.room_id);
      
      // ✅ UPDATED: Use room_type_id for restriction lookup (was room_id)
      const restrictionKey = roomTypeId ? `${roomTypeId}|${avail.date}` : null;
      const restriction = restrictionKey ? restrictionMap.get(restrictionKey) : null;

      // ✅ FIXED: Prioritize end_date from availability_calendar, fallback to restrictions
      const endDate = avail.end_date || restriction?.end_date || null;
      
      // Debug log for first few records
      if (index < 3) {
        console.log(`[Calendar API] 🔧 Merging record: room=${avail.room_id}, date=${avail.date}, avail.end_date=${avail.end_date}, restriction.end_date=${restriction?.end_date}, final_end_date=${endDate}`);
      }

      return {
        ...avail,
        room_type_id: roomTypeId,  // ✅ NEW: Include room_type_id in response
        end_date: endDate,
        applied_days: avail.applied_days || restriction?.applied_days || null,  // ✅ NEW: Include applied_days (prioritize availability, fallback to restriction)
        min_nights: restriction?.min_nights || null,
        max_nights: restriction?.max_nights || null,
        close_to_arrival: restriction?.close_to_arrival || false,
        close_to_departure: restriction?.close_to_departure || false,
        // NOTE: Rate overrides are returned separately, not merged here
      };
    });

    // Merge reservation occupancy blocks into availability records.
    // If the same room/date is already blocked in availability_calendar, duplicate blocks are harmless.
    mergedRecords.push(...reservationBlockedRecords.map((record) => ({
      ...record,
      room_type_id: roomToRoomTypeMap.get(record.room_id),
      applied_days: record.applied_days || null,
      min_nights: null,
      max_nights: null,
      close_to_arrival: false,
      close_to_departure: false,
      override_type: null,
      override_value: null,
      derive_pricing: false,
      rate_plan_ids: [],
    })));

    console.log('[Calendar API] 📊 Merged records count:', mergedRecords.length);
    if (mergedRecords.length > 0) {
      console.log('[Calendar API] 🔍 Sample MERGED records (after merge):', mergedRecords.slice(0, 3).map(r => ({
        room_id: r.room_id,
        date: r.date,
        end_date: r.end_date,
        status: r.status
      })));
    }

    // Filter for date range - NO EXPANSION on backend anymore!
    // Return compact range records; component will handle expansion
    const recordsInRange = mergedRecords.filter(record => {
      const recordDate = record.date;
      const recordEndDate = record.end_date;

      // Record must start before or on maxDate
      if (recordDate > maxDate) return false;

      // Record must end after or on minDate (or be open-ended)
      if (recordEndDate && recordEndDate < minDate) return false;

      return true;
    });

    console.log('[Calendar API] ✅ Records after date filtering:', recordsInRange.length, '(NO expansion on backend)');

    // ✅ CRITICAL FIX: Don't expand on backend - let frontend handle it!
    // Return compact range records directly
    const expandedData = recordsInRange.map(record => ({
      room_id: record.room_id,
      date: record.date,
      end_date: record.end_date,  // Keep original end_date
      status: record.status,
      occupancy: record.occupancy || 1,
      notes: record.notes || null,
      reason: (record as any).reason || null,
      applied_days: record.applied_days || null,  // ✅ NEW: Include applied_days for OTA sync
      min_nights: record.min_nights || null,
      max_nights: record.max_nights || null,
      close_to_arrival: record.close_to_arrival || false,
      close_to_departure: record.close_to_departure || false,
      override_type: record.override_type || null,
      override_value: record.override_value || null,
      derive_pricing: record.derive_pricing || false,
      rate_plan_ids: record.rate_plan_ids || [],
    }));

    // ✅ NEW: Prepare rate overrides for separate response
    // Convert rateMap back to array format with proper structure
    const rateOverridesForResponse: any[] = [];
    const seenRateKeys = new Set<string>();
    
    (rateData ?? []).forEach(record => {
      const recordRatePlanIds = Array.isArray(record.rate_plan_ids)
        ? record.rate_plan_ids
        : (typeof record.rate_plan_ids === 'string' ? JSON.parse(record.rate_plan_ids) : []);
      
      recordRatePlanIds.forEach((ratePlanId: string) => {
        const key = `${record.room_type_id}|${record.date}|${ratePlanId}`;
        // Only include the most recent record per rate plan
        if (!seenRateKeys.has(key)) {
          seenRateKeys.add(key);
          rateOverridesForResponse.push({
            room_type_id: record.room_type_id,
            rate_plan_id: ratePlanId,
            date: record.date,
            end_date: record.end_date,
            override_type: record.override_type,
            override_value: record.override_value,
            derive_pricing: record.derive_pricing,
            applied_days: record.applied_days || null,  // ✅ NEW: Include applied_days for OTA sync
          });
        }
      });
    });

    // ✅ NEW: Return both availability and rate overrides separately
    return NextResponse.json({
      availability: expandedData,
      rateOverrides: rateOverridesForResponse,
    });
  } catch (error: any) {
    console.error('[Calendar API] Error fetching calendar availability:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch availability',
        message: error?.message,
        code: error?.code,
        details: error?.details,
      },
      { status: 500 }
    );
  }
}
