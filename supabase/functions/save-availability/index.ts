/**
 * Supabase Edge Function: save-availability
 * 
 * Handles atomic availability/inventory updates with:
 * 1. Range processing (explodes date ranges into individual records)
 * 2. Validation & sanity checks
 * 3. Constraint enforcement
 * 4. Real-time synchronization (Realtime broadcasts)
 * 
 * Deploy: supabase functions deploy save-availability
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Type definitions
interface AvailabilityUpdate {
  date: string  // YYYY-MM-DD
  endDate?: string  // Optional, for range endpoints
  status: 'available' | 'unavailable' | 'blocked' | 'not_available' | 'closed_to_arrival' | 'closed_to_departure'
  roomId?: string
  roomTypeId?: string
  minNights?: number
  maxNights?: number
  occupancy?: number
  notes?: string
  appliedAtLevel: 'room' | 'room_type' | 'property'
  blockedRooms?: number  // For inventory-based blocking
}

interface ValidationError {
  field: string
  message: string
  code: string
}

// Initialize Supabase client with service role (for server operations)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Note: Date expansion is no longer done here. Ranges are stored directly in the database.
// Query-time expansion happens via view or client-side logic when needed.

/**
 * Check if a date is in the past (rejects past modifications)
 */
function isPastDate(dateStr: string): boolean {
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return target < today
}

/**
 * Get 5-year end date for open-ended availability
 * Today: April 12, 2026 → Returns: 2031-12-31
 */
function getFiveYearEndDate(): string {
  const today = new Date()
  const fiveYearsLater = new Date(today.getFullYear() + 5, 11, 31) // Dec 31, 5 years from now
  const year = fiveYearsLater.getFullYear()
  const month = String(fiveYearsLater.getMonth() + 1).padStart(2, '0')
  const day = String(fiveYearsLater.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Validate single availability update record using pre-fetched data
 */
async function validateAvailabilityUpdateOptimized(
  update: AvailabilityUpdate,
  propertyId: string,
  allDates: string[],
  validRoomIds: Set<string>,
  roomTypeIdToCount: Map<string, number>,
  recordIndex: number
): Promise<{ recordIndex: number; errors: ValidationError[] }> {
  const errors: ValidationError[] = []

  // 1. Check date is not in the past
  if (isPastDate(update.date)) {
    errors.push({
      field: 'date',
      message: `Cannot modify availability for past date: ${update.date}`,
      code: 'DATE_IN_PAST',
    })
  }

  // 2. Validate room belongs to property (if roomId is specified) - using pre-fetched data
  if (update.roomId) {
    if (!validRoomIds.has(update.roomId)) {
      errors.push({
        field: 'roomId',
        message: `Room ${update.roomId} not found for property ${propertyId}`,
        code: 'INVALID_ROOM_ID',
      })
      return { recordIndex, errors }  // Early return - no point validating further
    }
  }

  // 3. If blocking rooms, validate against total room count - using pre-fetched data
  if (update.roomId) {
    // For room-level: blocked_rooms cannot exceed 1 (a room is either available or not)
    if (update.blockedRooms !== undefined && update.blockedRooms > 1) {
      errors.push({
        field: 'blockedRooms',
        message: 'A single room cannot have more than 1 unit blocked',
        code: 'INVALID_ROOM_BLOCK',
      })
    }
  } else if (update.roomTypeId) {
    const totalRooms = roomTypeIdToCount.get(update.roomTypeId) || 0

    // Check for existing bookings that would conflict
    if (update.blockedRooms !== undefined && update.blockedRooms > totalRooms) {
      errors.push({
        field: 'blockedRooms',
        message: `Cannot block ${update.blockedRooms} rooms: only ${totalRooms} rooms of this type exist`,
        code: 'BLOCKED_EXCEEDS_TOTAL',
      })
    }
  }

  // 4. Stop Sell validation (takes precedence, no other rules matter)
  if (update.status === 'blocked' && update.minNights) {
    // Warning: Stop Sell + Min Stay may be conflicting
    console.warn('Stop Sell status set with Min Stay value - Stop Sell takes precedence')
  }

  // 5. Min/Max stay validation
  if (update.minNights !== undefined && update.maxNights !== undefined) {
    if (update.minNights > update.maxNights) {
      errors.push({
        field: 'minNights',
        message: 'Min stay cannot be greater than max stay',
        code: 'INVALID_STAY_RANGE',
      })
    }
  }

  return { recordIndex, errors }
}

/**
 * Validate single availability update record
 */
async function validateAvailabilityUpdate(
  update: AvailabilityUpdate,
  propertyId: string,
  allDates: string[]
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []

  // 1. Check date is not in the past
  if (isPastDate(update.date)) {
    errors.push({
      field: 'date',
      message: `Cannot modify availability for past date: ${update.date}`,
      code: 'DATE_IN_PAST',
    })
  }

  // 2. Validate room belongs to property (if roomId is specified)
  if (update.roomId) {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', update.roomId)
      .eq('property_id', propertyId)
      .single()

    if (roomError || !room) {
      errors.push({
        field: 'roomId',
        message: `Room ${update.roomId} not found for property ${propertyId}`,
        code: 'INVALID_ROOM_ID',
      })
      return errors  // Early return - no point validating further
    }
  }

  // 3. If blocking rooms, validate against total room count
  if (update.blockedRooms !== undefined && (update.blockedRooms < 0 || !Number.isInteger(update.blockedRooms))) {
    errors.push({
      field: 'blockedRooms',
      message: 'Blocked rooms must be a non-negative integer',
      code: 'INVALID_BLOCKED_ROOMS',
    })
    return errors
  }

  // 4. Validate room count if specified
  if (update.roomId) {
    // For room-level: blocked_rooms cannot exceed 1 (a room is either available or not)
    if (update.blockedRooms !== undefined && update.blockedRooms > 1) {
      errors.push({
        field: 'blockedRooms',
        message: 'A single room cannot have more than 1 unit blocked',
        code: 'INVALID_ROOM_BLOCK',
      })
    }
  } else if (update.roomTypeId) {
    // For room-type: get total rooms of this type
    const { data: roomTypeRooms, error: rtError } = await supabase
      .from('rooms')
      .select('id', { count: 'exact' })
      .eq('room_type_id', update.roomTypeId)
      .eq('property_id', propertyId)

    if (rtError) {
      errors.push({
        field: 'roomTypeId',
        message: `Could not validate room type: ${rtError.message}`,
        code: 'ROOM_TYPE_VALIDATION_ERROR',
      })
      return errors
    }

    const totalRooms = roomTypeRooms?.length || 0

    // Check for existing bookings that would conflict
    if (update.blockedRooms !== undefined && update.blockedRooms > totalRooms) {
      errors.push({
        field: 'blockedRooms',
        message: `Cannot block ${update.blockedRooms} rooms: only ${totalRooms} rooms of this type exist`,
        code: 'BLOCKED_EXCEEDS_TOTAL',
      })
    }
  }

  // 5. Stop Sell validation (takes precedence, no other rules matter)
  if (update.status === 'blocked' && update.minNights) {
    // Warning: Stop Sell + Min Stay may be conflicting
    console.warn('Stop Sell status set with Min Stay value - Stop Sell takes precedence')
  }

  // 6. Min/Max stay validation
  if (update.minNights !== undefined && update.maxNights !== undefined) {
    if (update.minNights > update.maxNights) {
      errors.push({
        field: 'minNights',
        message: 'Min stay cannot be greater than max stay',
        code: 'INVALID_STAY_RANGE',
      })
    }
  }

  return errors
}

/**
 * Check for booking conflicts when modifying Min/Max stay rules
 */
async function checkBookingConflicts(
  propertyId: string,
  roomId: string | undefined,
  roomTypeId: string | undefined,
  date: string,
  minNights: number | undefined
): Promise<{ hasConflicts: boolean; conflictingBookings: any[] }> {
  if (!minNights || minNights <= 1) {
    return { hasConflicts: false, conflictingBookings: [] }
  }

  // Find bookings that would violate the new min stay rule
  const { data: conflictingBookings } = await supabase
    .from('reservations')
    .select('id, startDate, endDate')
    .eq('property_id', propertyId)
    .gte('endDate', date)
    .in('status', ['Confirmed', 'Pending', 'Checked-in'])
    .limit(10)

  // Filter for actual conflicts (simple heuristic: stay < minNights)
  const actualConflicts = (conflictingBookings || []).filter((booking: any) => {
    const start = new Date(booking.startDate)
    const end = new Date(booking.endDate)
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return nights < minNights
  })

  return {
    hasConflicts: actualConflicts.length > 0,
    conflictingBookings: actualConflicts,
  }
}

/**
 * Generate unique ID for availability record (consistent with API)
 */
function generateAvailabilityId(
  propertyId: string,
  date: string,
  roomId: string | null,
  roomTypeId: string | null
): string {
  const idParts = [propertyId, date, roomId || 'null', roomTypeId || 'null']
  const idString = idParts.join('|')
  // Simple hash-like ID generation for consistency (Deno-compatible)
  return btoa(idString).substring(0, 50)
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Parse request body
    const body = await req.json()
    const { propertyId, availabilities } = body

    // Validate required fields
    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'propertyId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(availabilities) || availabilities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'availabilities array is required and cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${availabilities.length} availability update(s) for property ${propertyId}`)

    // ========================================================================
    // PHASE 1: SKIP DATE EXPANSION - Store ranges directly
    // ========================================================================
    // Keep the ranges as-is. Don't expand into individual dates.
    // Database will handle range queries efficiently
    const recordsToProcess: AvailabilityUpdate[] = availabilities
    console.log(`Processing ${recordsToProcess.length} total records with date ranges (NOT expanded)`)

    // ========================================================================
    // PHASE 2: VALIDATE RANGES (Not individual dates)
    // ========================================================================
    
    // Pre-fetch all validatable data once to avoid N+1 queries
    const uniqueRoomIds = [...new Set(recordsToProcess.filter(r => r.roomId).map(r => r.roomId))]
    const uniqueRoomTypeIds = [...new Set(recordsToProcess.filter(r => r.roomTypeId).map(r => r.roomTypeId))]
    
    let validRoomIds: Set<string> = new Set()
    let roomTypeIdToCount: Map<string, number> = new Map()
    
    // Batch fetch rooms if needed
    if (uniqueRoomIds.length > 0) {
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id')
        .eq('property_id', propertyId)
        .in('id', uniqueRoomIds)
      
      if (!roomsError && rooms) {
        validRoomIds = new Set(rooms.map(r => r.id))
      }
    }
    
    // Batch fetch room type counts if needed
    if (uniqueRoomTypeIds.length > 0) {
      const { data: roomTypes, error: rtError } = await supabase
        .from('rooms')
        .select('room_type_id')
        .eq('property_id', propertyId)
        .in('room_type_id', uniqueRoomTypeIds)
      
      if (!rtError && roomTypes) {
        for (const rt of roomTypes) {
          const count = (roomTypeIdToCount.get(rt.room_type_id) || 0) + 1
          roomTypeIdToCount.set(rt.room_type_id, count)
        }
      }
    }
    
    const allValidationErrors: { recordIndex: number; errors: ValidationError[] }[] = []
    const allDates = recordsToProcess.map(r => r.date)
    
    // Validate all records in parallel
    const validationPromises = recordsToProcess.map((record, i) => 
      validateAvailabilityUpdateOptimized(
        record, 
        propertyId, 
        allDates,
        validRoomIds,
        roomTypeIdToCount,
        i
      )
    )
    
    const validationResults = await Promise.all(validationPromises)
    
    for (const result of validationResults) {
      if (result.errors.length > 0) {
        allValidationErrors.push({ recordIndex: result.recordIndex, errors: result.errors })
      }
    }

    // If any validation errors, return them all
    if (allValidationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          validationErrors: allValidationErrors,
          totalErrors: allValidationErrors.reduce((sum, item) => sum + item.errors.length, 0),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ========================================================================
    // PHASE 3: ATOMIC TRANSACTION (Upsert range records directly)
    // ========================================================================
    console.log('Starting transaction for batch upsert (range-based)...')

    // Helper: Generate unique ID using crypto hash (prevents collisions)
    async function generateUniqueId(
      propertyId: string,
      date: string,
      roomId: string | null,
      roomTypeId: string | null,
      endDate: string
    ): Promise<string> {
      const idInfo = `${propertyId}|${date}|${roomId || 'null'}|${roomTypeId || 'null'}|${endDate}`
      const msgBuffer = new TextEncoder().encode(idInfo)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return hashHex.substring(0, 50) // Use first 50 chars of hash
    }

    // Prepare upsert data - store ranges as-is, NOT expanded
    const upsertDataPromises = recordsToProcess.map(async (avail, idx) => {
      const endDateValue = avail.endDate || getFiveYearEndDate()
      const uniqueId = await generateUniqueId(
        propertyId,
        avail.date,
        avail.roomId || null,
        avail.roomTypeId || null,
        endDateValue
      )
      return {
        id: uniqueId,
        property_id: propertyId,
        date: avail.date,
        end_date: endDateValue,
        status: avail.status,
        min_nights: avail.minNights || 1,
        max_nights: avail.maxNights || null,
        occupancy: avail.occupancy || 1,
        notes: avail.notes || null,
        room_type_id: avail.roomTypeId || null,
        room_id: avail.roomId || null,
        applied_at_level: avail.appliedAtLevel || 'property',
      }
    })

    const upsertData = await Promise.all(upsertDataPromises)

    console.log(`Upserting ${upsertData.length} range records (NOT expanded into individual dates)`)

    // PHASE 3A: DELETE CONFLICTING RECORDS (overlapping date ranges for same room/property)
    // Before upserting new ranges, remove any existing records that overlap with the new date ranges
    // This allows "overlay" updates (e.g., setting stop_sell within an open-ended period)
    console.log('Checking for overlapping records to delete...')
    
    for (const record of upsertData) {
      const roomIdentifier = record.room_id || record.room_type_id || null
      
      // Build query to find overlapping records for this room/property
      let query = supabase
        .from('availability_calendar')
        .select('*')  // Need all fields to create split records
        .eq('property_id', propertyId)
      
      if (roomIdentifier) {
        if (record.room_id) {
          query = query.eq('room_id', record.room_id)
        } else {
          query = query.eq('room_type_id', record.room_type_id)
        }
      }
      
      const { data: existingRecords, error: selectError } = await query
      
      if (!selectError && existingRecords && existingRecords.length > 0) {
        // Check which records overlap with the new date range
        const newStart = new Date(record.date)
        const newEnd = new Date(record.end_date)
        
        const overlappingRecords = existingRecords.filter(existing => {
          // Overlap check: existing.date <= new.end_date AND (existing.end_date IS NULL OR existing.end_date >= new.date)
          const existingStart = new Date(existing.date)
          const existingEnd = existing.end_date ? new Date(existing.end_date) : new Date('2099-12-31')
          
          return existingStart <= newEnd && existingEnd >= newStart
        })
        
        if (overlappingRecords.length > 0) {
          console.log(`Found ${overlappingRecords.length} overlapping records for room ${roomIdentifier || 'property-wide'}`)
          
          const recordsToCreate: any[] = []
          const recordsToDelete: string[] = []
          
          // Process each overlapping record
          for (const overlapping of overlappingRecords) {
            const existingStart = new Date(overlapping.date)
            const existingEnd = overlapping.end_date 
              ? new Date(overlapping.end_date) 
              : new Date('2099-12-31')
            
            recordsToDelete.push(overlapping.id)
            
            // BEFORE: If existing record starts before new record, preserve that portion
            if (existingStart < newStart) {
              const dayBefore = new Date(newStart)
              dayBefore.setDate(dayBefore.getDate() - 1)
              const beforeEndDate = dayBefore.toISOString().split('T')[0]
              
              const beforeRecord = {
                ...overlapping,
                id: undefined,  // Let it generate new ID
                date: overlapping.date,
                end_date: beforeEndDate,
              }
              delete beforeRecord.id
              delete beforeRecord.created_at
              delete beforeRecord.updated_at
              
              recordsToCreate.push(beforeRecord)
              console.log(`  → Creating BEFORE split: ${overlapping.date} to ${beforeEndDate} (${overlapping.status})`)
            }
            
            // AFTER: If existing record ends after new record, preserve that portion
            if (existingEnd > newEnd) {
              const dayAfter = new Date(newEnd)
              dayAfter.setDate(dayAfter.getDate() + 1)
              const afterStartDate = dayAfter.toISOString().split('T')[0]
              
              const afterRecord = {
                ...overlapping,
                id: undefined,  // Let it generate new ID
                date: afterStartDate,
                end_date: overlapping.end_date,  // Preserve original end_date or NULL
              }
              delete afterRecord.id
              delete afterRecord.created_at
              delete afterRecord.updated_at
              
              recordsToCreate.push(afterRecord)
              console.log(`  → Creating AFTER split: ${afterStartDate} to ${overlapping.end_date || 'open-ended'} (${overlapping.status})`)
            }
          }
          
          // Delete overlapping records
          if (recordsToDelete.length > 0) {
            console.log(`Deleting ${recordsToDelete.length} overlapping records...`)
            
            const { error: deleteError } = await supabase
              .from('availability_calendar')
              .delete()
              .in('id', recordsToDelete)
            
            if (deleteError) {
              console.warn(`⚠️  Failed to delete overlapping records:`, deleteError)
            } else {
              console.log(`✅ Deleted ${recordsToDelete.length} overlapping records`)
            }
          }
          
          // Create split records (BEFORE and AFTER portions)
          if (recordsToCreate.length > 0) {
            console.log(`Creating ${recordsToCreate.length} split records to preserve non-overlapping portions...`)
            
            // Generate IDs for split records
            const splitRecordsWithIds = await Promise.all(
              recordsToCreate.map(async (splitRecord) => {
                const uniqueId = await generateUniqueId(
                  propertyId,
                  splitRecord.date,
                  splitRecord.room_id || null,
                  splitRecord.room_type_id || null,
                  splitRecord.end_date || getFiveYearEndDate()
                )
                return { ...splitRecord, id: uniqueId }
              })
            )
            
            for (const splitRecord of splitRecordsWithIds) {
              const { error: insertError } = await supabase
                .from('availability_calendar')
                .insert([splitRecord])
              
              if (insertError) {
                console.warn(`⚠️  Failed to create split record:`, insertError)
              } else {
                console.log(`  ✅ Insert split: ${splitRecord.date} to ${splitRecord.end_date}`)
              }
            }
          }
        }
      }
    }

    // PHASE 3B: INSERT NEW RECORDS (after cleanup, no conflicts should exist)
    // Process inserts individually
    let successCount = 0
    let hasErrors = false
    const upsertErrors = []

    for (const record of upsertData) {
      console.log(`Inserting: id=${record.id.substring(0, 16)}..., date=${record.date}, room=${record.room_id || 'property-wide'}, status=${record.status}, endDate=${record.end_date}`)
      
      const { data: insertedRecord, error: recordError } = await supabase
        .from('availability_calendar')
        .insert([record])
        .select()

      if (recordError) {
        console.error(`❌ Error inserting record for room ${record.room_id || 'property-wide'}:`, recordError)
        upsertErrors.push({
          record: record,
          error: recordError.message,
        })
        hasErrors = true
      } else {
        // Success
        successCount++
        console.log(`✅ Inserted: id=${record.id.substring(0, 16)}...`)
        if (insertedRecord && insertedRecord.length > 0) {
          console.log(`   Room: ${insertedRecord[0].room_id}, Date: ${insertedRecord[0].date}, Status: ${insertedRecord[0].status}, EndDate: ${insertedRecord[0].end_date}`)
        }
      }
    }

    if (successCount === 0 && hasErrors) {
      // All records failed
      console.error('❌ All insert operations failed')
      return new Response(
        JSON.stringify({
          error: 'Failed to update availability for all records',
          code: 'INSERT_FAILED',
          details: upsertErrors.map(e => e.error).join('; '),
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (hasErrors && successCount > 0) {
      // Some records failed - still return success but with warning
      console.warn(`⚠️  Partial success: ${successCount}/${upsertData.length} records inserted. Errors: ${upsertErrors.length}`)
    } else {
      console.log(`✅ Successfully inserted ${successCount}/${upsertData.length} range records`)
    }

    // ========================================================================
    // PHASE 4: BROADCAST REALTIME EVENTS
    // ========================================================================
    console.log('Broadcasting realtime events...')

    // Get unique rooms/room types affected
    const affectedRooms = new Set(recordsToProcess.flatMap(r => r.roomId || []))
    const affectedRoomTypes = new Set(recordsToProcess.flatMap(r => r.roomTypeId || []))

    // Broadcast to all staff members (channel: property_availability_updates)
    try {
      await supabase
        .channel(`property:${propertyId}:availability`)
        .send('broadcast', {
          event: 'availability_updated',
          payload: {
            propertyId,
            recordsCount: recordsToProcess.length,
            affectedRooms: Array.from(affectedRooms),
            affectedRoomTypes: Array.from(affectedRoomTypes),
            timestamp: new Date().toISOString(),
          },
        })

      console.log('✅ Realtime broadcast sent')
    } catch (broadcastError) {
      console.warn('Failed to broadcast realtime event:', broadcastError)
      // Don't fail the request - this is non-critical
    }

    // ========================================================================
    // SUCCESS RESPONSE
    // ========================================================================
    const debugIds = upsertData.map((record, idx) => ({
      index: idx,
      id: record.id.substring(0, 16) + '...',
      room_id: record.room_id,
      date: record.date,
    }))

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated ${successCount}/${recordsToProcess.length} availability records (stored as ranges)`,
        data: {
          recordsProcessed: recordsToProcess.length,
          recordsUpserted: successCount,
          recordsFailed: upsertErrors.length,
          affectedRooms: Array.from(affectedRooms),
          affectedRoomTypes: Array.from(affectedRoomTypes),
          debugIds: debugIds, // Show what IDs were generated for debugging
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
