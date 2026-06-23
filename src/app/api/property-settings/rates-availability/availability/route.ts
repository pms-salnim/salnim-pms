import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ====================================================================
// HELPER FUNCTIONS FOR DATE RANGE OPERATIONS
// ====================================================================

function isDateBefore(date1: string, date2: string): boolean {
  return date1 < date2;
}

function isDateAfter(date1: string, date2: string): boolean {
  return date1 > date2;
}

function isDateEqual(date1: string, date2: string): boolean {
  return date1 === date2;
}

function dateToNextDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function dateToPrevDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

function rangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return !(isDateAfter(start1, end2) || isDateBefore(end1, start2));
}

/**
 * Split an existing range around a new overlapping range
 * Returns array of non-overlapping parts that should be re-inserted
 */
function splitRange(
  existStart: string,
  existEnd: string,
  newStart: string,
  newEnd: string,
  existingStatus: string
): Array<{ start: string; end: string; status: string }> {
  const result: Array<{ start: string; end: string; status: string }> = [];

  // Part BEFORE the new range
  if (isDateBefore(existStart, newStart)) {
    result.push({
      start: existStart,
      end: dateToPrevDay(newStart),
      status: existingStatus,
    });
  }

  // Part AFTER the new range
  if (isDateAfter(existEnd, newEnd)) {
    result.push({
      start: dateToNextDay(newEnd),
      end: existEnd,
      status: existingStatus,
    });
  }

  return result;
}

// ====================================================================
// GET: Fetch availability for a date range
// ====================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const roomTypeId = searchParams.get('roomTypeId');
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');

    if (!propertyId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'propertyId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Build query with proper NULL handling for end_date
    // A record matches if: date <= queryEnd AND (end_date IS NULL OR end_date >= queryStart)
    let query = supabase
      .from('availability_calendar')
      .select('*')
      .eq('property_id', propertyId)
      .lte('date', endDate)                    // record.date <= queryEnd
      .order('date', { ascending: true });

    // Apply roomType/room/status filters if provided
    if (roomTypeId) query = query.eq('room_type_id', roomTypeId);
    if (roomId) query = query.eq('room_id', roomId);
    if (status) query = query.eq('status', status);

    // Execute query
    const { data, error } = await query;

    if (error) throw error;

    // Filter client-side for end_date (to handle NULL values properly)
    // end_date IS NULL (open-ended) OR end_date >= startDate
    const filteredData = data?.filter(record => 
      record.end_date === null || record.end_date >= startDate
    ) || [];

    return NextResponse.json({ data: filteredData });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}

// POST: Create or update availability with automatic range splitting
export async function POST(request: NextRequest) {
  try {
    // ====================================================================
    // STEP 1: Parse and validate request body
    // ====================================================================
    
    const body = await request.json()
    const { propertyId, availabilities } = body

    if (!propertyId || !availabilities || !Array.isArray(availabilities)) {
      return NextResponse.json(
        { 
          error: 'propertyId and availabilities array are required',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    if (availabilities.length === 0) {
      return NextResponse.json(
        { 
          error: 'availabilities array cannot be empty',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    // ====================================================================
    // STEP 2: Initialize Supabase client
    // ====================================================================
    
    const supabase = createClient()

    console.log(`[Availability API] Processing ${availabilities.length} availability updates for property ${propertyId}`)

    // ====================================================================
    // STEP 3: Process each availability update WITH RANGE SPLITTING
    // ====================================================================

    let totalRecordsUpserted = 0

    for (const availability of availabilities) {
      try {
        const { 
          date: startDate, 
          endDate, 
          status, 
          roomId, 
          roomTypeId,
          notes,
          appliedDays,
        } = availability

        // Validate required fields
        if (!startDate || !status) {
          console.warn('[Availability API] Skipping record with missing date or status:', availability)
          continue
        }

        // Determine which field(s) we have
        if (!roomId && !roomTypeId) {
          console.warn('[Availability API] Skipping record with missing roomId and roomTypeId:', availability)
          continue
        }

        // ✅ If we have roomId, look up the room_type_id
        let finalRoomId = roomId
        let finalRoomTypeId = roomTypeId

        if (roomId && !roomTypeId) {
          // Look up the room to get its room_type_id
          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('room_type_id')
            .eq('id', roomId)
            .single()

          if (roomError || !roomData) {
            console.warn(`[Availability API] Could not find room_type_id for roomId ${roomId}`, roomError)
            continue
          }

          finalRoomTypeId = roomData.room_type_id
          console.log(`[Availability API] Looked up room_type_id: ${finalRoomTypeId} for roomId: ${roomId}`)
        }

        const effectiveEndDate = endDate || startDate
        const targetField = roomId ? 'room_id' : 'room_type_id'
        const targetId = roomId || roomTypeId

        console.log(`[Availability API] Processing: ${targetField}=${targetId}, dates: ${startDate} to ${effectiveEndDate}, status: ${status}`)

        // ✅ STEP 3a: FETCH all overlapping records for this room/roomType
        console.log(`[Availability API] Fetching overlapping records...`)
        
        const { data: existingRecords, error: fetchError } = await supabase
          .from('availability_calendar')
          .select('*')
          .eq(targetField, targetId)
          .eq('property_id', propertyId)
          .lte('date', effectiveEndDate)
          .gte('end_date', startDate)

        if (fetchError) {
          console.error('[Availability API] Fetch error:', fetchError)
          throw new Error(`Failed to fetch overlapping records: ${fetchError.message}`)
        }

        console.log(`[Availability API] Found ${existingRecords?.length || 0} overlapping records`)

        // ✅ STEP 3b: Process each overlapping record - split and collect for re-insertion
        const recordsToDelete: string[] = []
        const recordsToInsert: any[] = []

        for (const existing of existingRecords || []) {
          const existStart = existing.date
          const existEnd = existing.end_date

          // Check if this record actually overlaps
          if (rangesOverlap(existStart, existEnd, startDate, effectiveEndDate)) {
            console.log(`[Availability API] Splitting existing record: ${existStart} to ${existEnd} (status: ${existing.status})`)
            
            // Mark this record for deletion
            recordsToDelete.push(existing.id)

            // Get the non-overlapping parts
            const splitParts = splitRange(existStart, existEnd, startDate, effectiveEndDate, existing.status)

            console.log(`[Availability API] Split result: ${splitParts.length} parts to re-insert`)

            // Queue the split parts for re-insertion
            for (const part of splitParts) {
              // ✅ ONLY include essential fields; let DB generate UUID id
              const partRecord: any = {
                property_id: propertyId,
                room_id: finalRoomId,
                room_type_id: finalRoomTypeId,
                date: part.start,
                end_date: part.end,
                status: part.status,
                applied_at_level: existing.applied_at_level || (finalRoomId ? 'room' : 'room_type'),
              }

              // Only add notes if present
              if (existing.notes !== null && existing.notes !== undefined) {
                partRecord.notes = existing.notes
              }

              recordsToInsert.push(partRecord)
              console.log(`[Availability API] Queued split part: ${part.start} to ${part.end} (${part.status})`)
            }
          }
        }

        // ✅ STEP 3c: Generate ID for the new record
        // ✅ STEP 3d: Build the new record - ONLY essential fields
        const newRecord: any = {
          property_id: propertyId,
          room_id: finalRoomId,
          room_type_id: finalRoomTypeId,
          date: startDate,
          end_date: effectiveEndDate,
          status: status,
          applied_at_level: finalRoomId ? 'room' : 'room_type',
        }

        // Only add notes if provided
        if (notes !== undefined && notes !== null) {
          newRecord.notes = notes
        }
        // ✅ NEW: Include applied_days if provided
        if (appliedDays !== undefined && appliedDays !== null && Array.isArray(appliedDays)) {
          newRecord.applied_days = appliedDays
        }
        recordsToInsert.push(newRecord)
        console.log(`[Availability API] Added new record: ${startDate} to ${effectiveEndDate} (${status})`)

        // ✅ STEP 3e: Delete old overlapping records
        if (recordsToDelete.length > 0) {
          console.log(`[Availability API] Deleting ${recordsToDelete.length} old records...`)
          const { error: deleteError, count: deletedCount } = await supabase
            .from('availability_calendar')
            .delete()
            .in('id', recordsToDelete)

          if (deleteError) {
            console.error('[Availability API] Delete error:', deleteError)
            throw new Error(`Failed to delete overlapping records: ${deleteError.message}`)
          }

          console.log(`[Availability API] ✓ Deleted ${deletedCount} records`)
        }

        // ✅ STEP 3f: Insert all new records (split parts + new record)
        if (recordsToInsert.length > 0) {
          console.log(`[Availability API] Inserting ${recordsToInsert.length} records...`)
          console.log(`[Availability API] Sample record to insert:`, recordsToInsert[0])
          const { error: insertError, data: insertedData } = await supabase
            .from('availability_calendar')
            .insert(recordsToInsert)
            .select()

          if (insertError) {
            console.error('[Availability API] Insert error:', {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
            })
            throw new Error(`Failed to insert records: ${insertError.message}`)
          }

          console.log(`[Availability API] ✓ Inserted ${insertedData?.length || 0} records`)
          totalRecordsUpserted += (insertedData?.length || 0)
        }

      } catch (recordError) {
        console.error('[Availability API] Error processing record:', recordError)
        throw recordError
      }
    }

    // ====================================================================
    // STEP 4: Return success response
    // ====================================================================

    console.log(`[Availability API] ✅ Success: Processed ${totalRecordsUpserted} availability records`)

    return NextResponse.json({
      success: true,
      data: {
        recordsUpserted: totalRecordsUpserted,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('[Availability API] Unexpected error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    return NextResponse.json(
      {
        error: 'Failed to process availability update',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// PUT: Update availability
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { availabilityId, status, minNights, maxNights, occupancy, notes } = body;

    if (!availabilityId) {
      return NextResponse.json(
        { error: 'availabilityId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (minNights !== undefined) updateData.min_nights = minNights;
    if (maxNights !== undefined) updateData.max_nights = maxNights;
    if (occupancy !== undefined) updateData.occupancy = occupancy;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('availability_calendar')
      .update(updateData)
      .eq('id', availabilityId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating availability:', error);
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    );
  }
}

// DELETE: Delete availability entries
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { availabilityIds } = body;

    if (!availabilityIds || !Array.isArray(availabilityIds) || availabilityIds.length === 0) {
      return NextResponse.json(
        { error: 'availabilityIds array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('availability_calendar')
      .delete()
      .in('id', availabilityIds);

    if (error) throw error;

    return NextResponse.json({ message: 'Availability entries deleted successfully' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    return NextResponse.json(
      { error: 'Failed to delete availability' },
      { status: 500 }
    );
  }
}
