/**
 * Availability Query Builder
 * 
 * Smart query construction for different availability use cases.
 * Handles efficient filtering without client-side expansion in common cases.
 */

import { createClient } from '@/lib/supabase/client'
import type { AvailabilityRecord, DateRange } from './availability-range-utils'

/**
 * Query options for different availability lookups
 */
export interface AvailabilityQueryOptions {
  /**
   * Date range to query
   */
  dateRange: DateRange

  /**
   * Filter by specific property
   */
  propertyId: string

  /**
   * Optional: filter by room ID
   */
  roomId?: string

  /**
   * Optional: filter by room type ID
   */
  roomTypeId?: string

  /**
   * Optional: filter by status
   */
  status?: string

  /**
   * Optional: limit results
   */
  limit?: number
}

/**
 * Get availability records for a date range
 * Efficiently queries only records whose ranges overlap with the query range
 * 
 * @param options - Query options
 * @returns Array of ranges (NOT expanded into individual dates)
 */
export async function queryAvailabilityRanges(options: AvailabilityQueryOptions): Promise<AvailabilityRecord[]> {
  const { dateRange, propertyId, roomId, roomTypeId, status, limit = 1000 } = options
  const supabase = createClient()

  // Build query: record.date <= queryEnd (mandatory)
  let query = supabase
    .from('availability_calendar')
    .select('*')
    .eq('property_id', propertyId)
    .lte('date', dateRange.endDate) // record.date <= queryEnd

  // Apply optional filters
  if (roomId) {
    query = query.eq('room_id', roomId)
  }

  if (roomTypeId) {
    query = query.eq('room_type_id', roomTypeId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.limit(limit)

  if (error) {
    console.error('Query error:', error)
    throw new Error(`Failed to query availability: ${error.message}`)
  }

  // Filter client-side for end_date (to handle NULL values properly)
  // A record's range overlaps if: end_date IS NULL (open-ended) OR end_date >= queryStart
  const filtered = (data || []).filter(record => 
    record.end_date === null || record.end_date >= dateRange.startDate
  ) as AvailabilityRecord[]

  return filtered
}

/**
 * Get availability for a single date
 * @param propertyId - Property ID
 * @param date - Target date (YYYY-MM-DD)
 * @param roomId - Optional room ID
 * @returns Records covering this date
 */
export async function queryAvailabilityForDate(
  propertyId: string,
  date: string,
  roomId?: string
): Promise<AvailabilityRecord[]> {
  return queryAvailabilityRanges({
    propertyId,
    dateRange: { startDate: date, endDate: date },
    roomId,
  })
}

/**
 * Check if a specific date/room combination is available
 * @param propertyId - Property ID
 * @param date - Target date (YYYY-MM-DD)
 * @param roomId - Room ID (optional)
 * @returns true if any matching record has status 'available'
 */
export async function isDateAvailable(
  propertyId: string,
  date: string,
  roomId?: string
): Promise<boolean> {
  const records = await queryAvailabilityForDate(propertyId, date, roomId)
  return records.some(r => r.status === 'available')
}

/**
 * Get blocked dates for calendar view (for small date range)
 * Returns ONLY blocked/unavailable dates, ideal for highlighting in UI
 * @param propertyId - Property ID
 * @param dateRange - Date range to query
 * @param blockStatuses - Statuses to consider as "blocked" (default: blocked, not_available)
 * @returns Map of date -> count of blocking records
 */
export async function queryBlockedDates(
  propertyId: string,
  dateRange: DateRange,
  blockStatuses: string[] = ['not_available', 'blocked', 'closed_to_arrival']
): Promise<Map<string, number>> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('availability_calendar')
    .select('date, end_date, status')
    .eq('property_id', propertyId)
    .lte('date', dateRange.endDate)
    .in('status', blockStatuses)

  if (error) {
    throw new Error(`Failed to query blocked dates: ${error.message}`)
  }

  // Filter client-side for end_date (to handle NULL)
  const filtered = (data || []).filter(record => 
    record.end_date === null || record.end_date >= dateRange.startDate
  );

  // Map each date to count of blocking records
  const blockedMap = new Map<string, number>()

  for (const record of filtered) {
    const startDate = new Date(record.date)
    const endDate = new Date(record.end_date || dateRange.endDate)

    let current = startDate
    while (current <= endDate && current.toISOString().split('T')[0] <= dateRange.endDate) {
      const dateStr = current.toISOString().split('T')[0]
      if (dateStr >= dateRange.startDate) {
        blockedMap.set(dateStr, (blockedMap.get(dateStr) || 0) + 1)
      }
      current.setDate(current.getDate() + 1)
    }
  }

  return blockedMap
}

/**
 * Get a timeline of availability changes
 * Useful for calendars, showing when availability status changes
 * @param propertyId - Property ID
 * @param dateRange - Date range
 * @returns Sorted array of records representing status changes
 */
export async function queryAvailabilityTimeline(
  propertyId: string,
  dateRange: DateRange
): Promise<AvailabilityRecord[]> {
  const records = await queryAvailabilityRanges({
    propertyId,
    dateRange,
  })

  // Sort by start date, then by scope (more specific first)
  return records.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)

    // Prioritize: room > room_type > property
    const aScore = (a.room_id ? 3 : a.room_type_id ? 2 : 1)
    const bScore = (b.room_id ? 3 : b.room_type_id ? 2 : 1)
    return bScore - aScore
  })
}

/**
 * Get availability for a room type across a date range
 * Considers both room-type-level and property-level records
 * @param propertyId - Property ID
 * @param roomTypeId - Room type ID
 * @param dateRange - Date range
 * @returns Records at room type level (excludes specific room records)
 */
export async function queryRoomTypeAvailability(
  propertyId: string,
  roomTypeId: string,
  dateRange: DateRange
): Promise<AvailabilityRecord[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('availability_calendar')
    .select('*')
    .eq('property_id', propertyId)
    .eq('room_type_id', roomTypeId)
    .isNull('room_id') // Only room-type-level records
    .lte('date', dateRange.endDate)
    .order('date')

  if (error) {
    throw new Error(`Failed to query room type availability: ${error.message}`)
  }

  // Filter client-side for end_date (to handle NULL)
  const filtered = (data || []).filter(record => 
    record.end_date === null || record.end_date >= dateRange.startDate
  );

  return filtered as AvailabilityRecord[]
}

/**
 * Get all availability records for a property (for syncing/caching)
 * Warning: This can be large for properties with many overrides
 * Consider paginating in production
 */
export async function queryAllPropertyAvailability(propertyId: string): Promise<AvailabilityRecord[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('availability_calendar')
    .select('*')
    .eq('property_id', propertyId)
    .order('date')

  if (error) {
    throw new Error(`Failed to query all availability: ${error.message}`)
  }

  return (data || []) as AvailabilityRecord[]
}
