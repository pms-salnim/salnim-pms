/**
 * Availability Range System - Usage Examples
 * 
 * This file demonstrates practical usage of the new range-based availability system.
 * The system stores continuous availability ranges instead of individual date records,
 * reducing storage and improving query performance.
 */

// ============================================================================
// SAVING AVAILABILITY (Always)
// ============================================================================

import {
  saveAvailability,
  buildRangeUpdate,
  buildOpenEndedUpdate,
  buildMaintenanceBlock,
  buildSeasonalPattern,
} from '@/lib/availability-service'

import {
  queryAvailabilityRanges,
  queryAvailabilityForDate,
  isDateAvailable,
  queryBlockedDates,
} from '@/lib/availability-query-builder'

import {
  expandAvailabilityForDateRange,
  findAvailabilityForDate,
  expandDateRange,
} from '@/lib/availability-range-utils'

// ============================================================================
// EXAMPLE 1: Mark a date range as available for multiple rooms
// ============================================================================

async function example1_OpenRoomsForSeason() {
  // Summer season: mark all rooms available May-August
  const updates = buildRangeUpdate({
    startDate: '2026-05-01',
    endDate: '2026-08-31',
    status: 'available',
    roomIds: ['room-1', 'room-2', 'room-3'],
  })

  const response = await saveAvailability({
    propertyId: 'prop-123',
    availabilities: updates,
  })

  console.log(`Opened ${updates.length} room ranges for summer season`)
  return response
}

// ============================================================================
// EXAMPLE 2: Block rooms for maintenance
// ============================================================================

async function example2_ScheduleMaintenance() {
  const request = buildMaintenanceBlock({
    propertyId: 'prop-123',
    startDate: '2026-04-20',
    endDate: '2026-04-25',
    reason: 'HVAC system replacement',
    roomIds: ['room-1', 'room-2'], // Leave other rooms available
  })

  const response = await saveAvailability(request)
  console.log('Maintenance blocked')
  return response
}

// ============================================================================
// EXAMPLE 3: Query calendar for a month (common use case)
// ============================================================================

async function example3_GetMonthAvailability() {
  // Query April 2026
  const records = await queryAvailabilityRanges({
    propertyId: 'prop-123',
    dateRange: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
  })

  console.log(`Found ${records.length} availability records for April`)

  // Now expand only the records for calendar display
  const expanded = expandAvailabilityForDateRange(
    records,
    '2026-04-01',
    '2026-04-30'
  )

  console.log(`Expanded to ${expanded.length} date records`)

  // Group by date for rendering
  const byDate = new Map<string, typeof expanded>()
  for (const record of expanded) {
    if (!byDate.has(record.date)) {
      byDate.set(record.date, [])
    }
    byDate.get(record.date)!.push(record)
  }

  return byDate
}

// ============================================================================
// EXAMPLE 4: Check single date availability (most common query)
// ============================================================================

async function example4_CheckDateAvailable() {
  // Simple check: is April 15 available for room-1?
  const isAvailable = await isDateAvailable('prop-123', '2026-04-15', 'room-1')

  if (isAvailable) {
    console.log('✓ April 15 is available - can accept booking')
  } else {
    console.log('✗ April 15 is not available')
  }

  return isAvailable
}

// ============================================================================
// EXAMPLE 5: Get blocked dates for highlighting in UI
// ============================================================================

async function example5_GetBlockedDatesForCalendar() {
  // Get all "blocked" dates for April
  const blockedMap = await queryBlockedDates(
    'prop-123',
    {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    ['not_available', 'blocked', 'closed_to_arrival']
  )

  console.log(`Found ${blockedMap.size} blocked dates in April`)

  // Use in React component:
  // <Calendar
  //   blockedDates={new Set(blockedMap.keys())}
  //   onDateClick={handleDateClick}
  // />

  return blockedMap
}

// ============================================================================
// EXAMPLE 6: Complex scenario - Multiple room types with overrides
// ============================================================================

async function example6_ComplexScenario() {
  // Property available all year
  // But room A blocked for maintenance
  // And room B has minimum 2-night stays

  const updates = [
    // Property-level: available all year
    buildOpenEndedUpdate({
      startDate: '2026-04-01',
      status: 'available',
    })[0], // buildOpenEndedUpdate returns array

    // Room A: blocked April 20-25
    {
      date: '2026-04-20',
      endDate: '2026-04-25',
      status: 'not_available' as const,
      roomId: 'room-1',
      notes: 'Plumbing repair',
      appliedAtLevel: 'room' as const,
    },

    // Room B: minimum 2 nights all summer
    {
      date: '2026-05-01',
      endDate: '2026-08-31',
      status: 'available',
      roomId: 'room-2',
      minNights: 2,
      appliedAtLevel: 'room' as const,
    },
  ]

  const response = await saveAvailability({
    propertyId: 'prop-123',
    availabilities: updates,
  })

  console.log('Complex scenario saved')
  return response
}

// ============================================================================
// EXAMPLE 7: Query and modify with priority (room > room_type > property)
// ============================================================================

async function example7_AtomsWithPriority() {
  // Get all availability for a specific date range and room
  const records = await queryAvailabilityRanges({
    propertyId: 'prop-123',
    dateRange: {
      startDate: '2026-04-15',
      endDate: '2026-04-20',
    },
    roomId: 'room-1',
  })

  // Find the best match for a specific date (respects priority)
  const availability = findAvailabilityForDate(
    records,
    '2026-04-17',
    'room-1'
  )

  if (availability) {
    console.log(`Status: ${availability.status}`)
    console.log(`Min nights: ${availability.min_nights}`)
    console.log(`Applied at: ${availability.applied_at_level}`)
  }

  return availability
}

// ============================================================================
// EXAMPLE 8: In a React component - Calendar
// ============================================================================

/*
// Component example (simplified)
import { useState, useEffect } from 'react'
import { queryBlockedDates, queryAvailabilityRanges } from '@/lib/availability-query-builder'

export function AvailabilityCalendar({ propertyId, year, month }) {
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCalendar = async () => {
      // Get blocked dates for the month
      const blockedMap = await queryBlockedDates(propertyId, {
        startDate: `${year}-${String(month).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month + 1).padStart(2, '0')}-28`, // Approximate
      })

      setBlockedDates(new Set(blockedMap.keys()))
      setLoading(false)
    }

    loadCalendar()
  }, [propertyId, year, month])

  return (
    <div className="calendar">
      {Array.from({ length: 31 }, (_, i) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
        const isBlocked = blockedDates.has(date)

        return (
          <div
            key={date}
            className={`day ${isBlocked ? 'bg-red-100' : 'bg-green-100'}`}
          >
            {i + 1}
          </div>
        )
      })}
    </div>
  )
}
*/

// ============================================================================
// EXAMPLE 9: Booking engine integration
// ============================================================================

async function example9_CheckBooking() {
  // User requests: room-1, April 15-20
  const checkInDate = '2026-04-15'
  const checkOutDate = '2026-04-20'
  const roomId = 'room-1'

  // Expand the date range to check each night
  const nights = expandDateRange(checkInDate, checkOutDate)

  // Query all records that might affect these dates
  const records = await queryAvailabilityRanges({
    propertyId: 'prop-123',
    dateRange: {
      startDate: checkInDate,
      endDate: checkOutDate,
    },
    roomId,
  })

  // Check each night
  const availableNights = nights.filter(date => {
    const record = findAvailabilityForDate(records, date, roomId)
    return record?.status === 'available'
  })

  const isFullyAvailable = availableNights.length === nights.length

  console.log(`${availableNights.length}/${nights.length} nights available`)
  console.log(isFullyAvailable ? '✓ Can accept booking' : '✗ Some nights blocked')

  return { isFullyAvailable, availableNights }
}

// ============================================================================
// KEY DIFFERENCES FROM OLD SYSTEM
// ============================================================================

/*
OLD (Individual dates in DB):
- 100 dates = 100 database records
- Each update created/modified many records
- Query expansion happened on database

NEW (Range-based in DB):
- 100 consecutive dates = 1 database record
- Each update creates/modifies 1 record
- Query expansion happens client-side when needed
- Much faster saves and syncs
- More efficient for bulk operations

WHEN TO EXPAND:
✓ Calendar display (need to highlight individual dates)
✓ Booking validation (check each night)
✓ Looking for gaps in availability

WHEN NOT TO EXPAND:
✓ Just checking if ONE date is available
✓ Getting yearly trends
✓ Filtering by status
✓ Serializing to API (just return ranges)
*/
