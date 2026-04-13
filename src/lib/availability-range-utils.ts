/**
 * Availability Range Utilities
 * 
 * Client-side helpers for working with range-based availability storage.
 * These utilities expand ranges on-demand for querying and display.
 */

/**
 * Represents a single availability record from the database
 */
export interface AvailabilityRecord {
  id: string
  property_id: string
  date: string // YYYY-MM-DD (start date)
  end_date: string | null // YYYY-MM-DD (end date, inclusive) or null for open-ended
  status: AvailabilityStatus
  min_nights: number
  max_nights: number | null
  occupancy: number | null
  notes: string | null
  room_type_id: string | null
  room_id: string | null
  applied_at_level: 'property' | 'room_type' | 'room'
  created_at?: string
  updated_at?: string
}

/**
 * Expanded availability record (one per date)
 */
export interface ExpandedAvailability extends AvailabilityRecord {
  // Same as AvailabilityRecord, just semantically represents a single date
}

export type AvailabilityStatus = 
  | 'available'
  | 'not_available'
  | 'closed_to_arrival'
  | 'closed_to_departure'
  | 'on_request'
  | 'blocked'
  | 'unavailable'

export interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

/**
 * Check if a date is within a range (inclusive)
 * @param date - Date to check (YYYY-MM-DD)
 * @param rangeStart - Range start (YYYY-MM-DD)
 * @param rangeEnd - Range end (YYYY-MM-DD)
 * @returns true if date is within range
 */
export function isDateInRange(date: string, rangeStart: string, rangeEnd: string): boolean {
  return date >= rangeStart && date <= rangeEnd
}

/**
 * Get all dates between two dates (inclusive)
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of dates in YYYY-MM-DD format
 */
export function expandDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Expand availability records for a specific date range
 * Only expands records whose ranges overlap with the query range
 * 
 * @param records - Database records (stored as ranges)
 * @param fromDate - Query range start (YYYY-MM-DD)
 * @param toDate - Query range end (YYYY-MM-DD)
 * @returns Expanded records, one per date
 */
export function expandAvailabilityForDateRange(
  records: AvailabilityRecord[],
  fromDate: string,
  toDate: string
): ExpandedAvailability[] {
  const expanded: ExpandedAvailability[] = []

  for (const record of records) {
    // Determine actual end date
    const actualEndDate = record.end_date || toDate // If open-ended, expand to query end

    // Check if this range overlaps with query range
    if (actualEndDate < fromDate || record.date > toDate) {
      continue // No overlap
    }

    // Expand this range to individual dates
    const rangeStart = record.date
    const rangeEnd = actualEndDate < toDate ? actualEndDate : toDate // Don't expand beyond query range
    const dates = expandDateRange(rangeStart, rangeEnd)

    for (const date of dates) {
      expanded.push({
        ...record,
        date, // Override with individual date
      })
    }
  }

  return expanded
}

/**
 * Find availability for a specific date (scans from multiple records)
 * Returns the most specific match: room > room_type > property
 * 
 * @param records - Database records
 * @param date - Target date (YYYY-MM-DD)
 * @param roomId - Specific room, if applicable
 * @param roomTypeId - Specific room type, if applicable
 * @returns Best matching availability record, or null
 */
export function findAvailabilityForDate(
  records: AvailabilityRecord[],
  date: string,
  roomId?: string,
  roomTypeId?: string
): AvailabilityRecord | null {
  // Filter records that cover this date
  const matchingRecords = records.filter(r => {
    const actualEndDate = r.end_date || '9999-12-31'
    return r.date <= date && date <= actualEndDate
  })

  if (matchingRecords.length === 0) return null

  // Prioritize: exact room > room type > property level
  if (roomId) {
    const roomMatch = matchingRecords.find(r => r.room_id === roomId)
    if (roomMatch) return roomMatch
  }

  if (roomTypeId) {
    const rtMatch = matchingRecords.find(r => r.room_type_id === roomTypeId && !r.room_id)
    if (rtMatch) return rtMatch
  }

  // Fall back to property level
  return matchingRecords.find(r => !r.room_id && !r.room_type_id) || matchingRecords[0]
}

/**
 * Check if a date is available (shorthand for common use case)
 * @param records - Database records
 * @param date - Date to check (YYYY-MM-DD)
 * @param roomId - Room ID (optional)
 * @returns true if status is 'available'
 */
export function isDateAvailable(
  records: AvailabilityRecord[],
  date: string,
  roomId?: string
): boolean {
  const record = findAvailabilityForDate(records, date, roomId)
  return record?.status === 'available'
}

/**
 * Get all unique dates covered by records
 * Useful for highlighting available/blocked dates in calendars
 */
export function getAllCoveredDates(records: AvailabilityRecord[]): string[] {
  const dates = new Set<string>()

  for (const record of records) {
    const actualEndDate = record.end_date || '9999-12-31'
    try {
      const expanded = expandDateRange(record.date, actualEndDate)
      expanded.forEach(d => dates.add(d))
    } catch (e) {
      // Skip invalid dates
      console.warn(`Invalid date range: ${record.date} to ${actualEndDate}`, e)
    }
  }

  return Array.from(dates).sort()
}

/**
 * Coalesce overlapping availability records
 * Merges adjacent/overlapping ranges with same status
 * Useful for compacting query results
 */
export function coalesceRanges(records: AvailabilityRecord[]): AvailabilityRecord[] {
  if (records.length === 0) return []

  // Sort by date, then by scope (room > room_type > property)
  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    const aSortKey = `${a.room_id || ''}${a.room_type_id || ''}${a.status}`
    const bSortKey = `${b.room_id || ''}${b.room_type_id || ''}${b.status}`
    return aSortKey.localeCompare(bSortKey)
  })

  const coalesced: AvailabilityRecord[] = []
  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    const currentEnd = current.end_date || '9999-12-31'

    // Check if next can be merged with current
    const canMerge =
      current.room_id === next.room_id &&
      current.room_type_id === next.room_type_id &&
      current.status === next.status &&
      current.applied_at_level === next.applied_at_level &&
      isDateInRange(next.date, current.date, currentEnd) // Overlapping or adjacent

    if (canMerge) {
      // Merge: extend end date
      const nextEnd = next.end_date || '9999-12-31'
      current = {
        ...current,
        end_date: nextEnd > currentEnd ? nextEnd : currentEnd,
      }
    } else {
      coalesced.push(current)
      current = next
    }
  }

  coalesced.push(current)
  return coalesced
}
