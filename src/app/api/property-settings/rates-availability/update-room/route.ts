import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ====================================================================
// HELPER FUNCTIONS FOR DATE RANGE OPERATIONS
// ====================================================================

function isDateBefore(date1: string, date2: string): boolean {
  return date1 < date2;
}

function isDateAfter(date1: string, date2: string): boolean {
  return date1 > date2;
}

function rangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return !(isDateAfter(start1, end2) || isDateBefore(end1, start2));
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

/**
 * Split an existing range around a new overlapping range
 * Returns array of non-overlapping parts that should be re-inserted
 */
function splitRange(
  existStart: string,
  existEnd: string,
  newStart: string,
  newEnd: string,
  existingData: any
): Array<{ start: string; end: string; data: any }> {
  const result: Array<{ start: string; end: string; data: any }> = [];

  // Part BEFORE the new range
  if (isDateBefore(existStart, newStart)) {
    result.push({
      start: existStart,
      end: dateToPrevDay(newStart),
      data: existingData,
    });
  }

  // Part AFTER the new range
  if (isDateAfter(existEnd, newEnd)) {
    result.push({
      start: dateToNextDay(newEnd),
      end: existEnd,
      data: existingData,
    });
  }

  return result;
}

// Helper to generate dates between start and end
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    dates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export async function POST(request: NextRequest) {
  try {
    const { propertyId, roomId, roomTypeId, date, startDate, endDate, status, reason, reasonDetails, notes } = await request.json();

    if (!propertyId || !roomId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, roomId, status' },
        { status: 400 }
      );
    }

    // Support both single date and date range
    let effectiveStartDate: string;
    let effectiveEndDate: string;
    let isSimpleUpdate = false;
    
    if (startDate && endDate) {
      // Bulk action: date range - apply range-splitting
      effectiveStartDate = startDate;
      effectiveEndDate = endDate;
      console.log('[Update Room API] Bulk action with range-splitting:', { propertyId, roomId, startDate, endDate, status });
    } else if (date) {
      // Single cell click: specific date - apply range-splitting to single day
      effectiveStartDate = date;
      effectiveEndDate = date;
      isSimpleUpdate = false; // Still apply range-splitting for consistency
      console.log('[Update Room API] Single cell click with range-splitting:', { propertyId, roomId, date, status });
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: either (date) or (startDate and endDate)' },
        { status: 400 }
      );
    }

    // ✅ STEP 1: FETCH all overlapping availability records for this room
    console.log(`[Update Room API] Fetching overlapping records for room ${roomId}...`);
    
    const { data: existingRecords, error: fetchError } = await supabase
      .from('availability_calendar')
      .select('*')
      .eq('room_id', roomId)
      .eq('property_id', propertyId)
      .lte('date', effectiveEndDate)
      .gte('end_date', effectiveStartDate);

    if (fetchError) {
      console.error('[Update Room API] Fetch error:', fetchError);
      throw new Error(`Failed to fetch overlapping records: ${fetchError.message}`);
    }

    console.log(`[Update Room API] Found ${existingRecords?.length || 0} overlapping records`);

    // ✅ STEP 2: Process overlapping records - merge if blocking, split if available
    const recordsToDelete: string[] = [];
    const recordsToInsert: any[] = [];
    
    // If creating a "not_available" block, collect all overlapping "not_available" blocks for merging
    let mergedBlockStart = effectiveStartDate;
    let mergedBlockEnd = effectiveEndDate;
    const overlappingNotAvailable: any[] = [];

    if (status === 'not_available') {
      // Find all overlapping 'not_available' blocks
      for (const existing of existingRecords || []) {
        if (existing.status === 'not_available' && rangesOverlap(existing.date, existing.end_date, effectiveStartDate, effectiveEndDate)) {
          overlappingNotAvailable.push(existing);
          
          // Expand the merged range to include this block
          if (existing.date < mergedBlockStart) {
            mergedBlockStart = existing.date;
          }
          if (existing.end_date > mergedBlockEnd) {
            mergedBlockEnd = existing.end_date;
          }
          
          // Mark for deletion
          recordsToDelete.push(existing.id);
          console.log(`[Update Room API] Will merge existing not_available block: ${existing.date} to ${existing.end_date}`);
        }
      }
    }

    // For 'available' status or when not merging, apply split logic to existing not_available blocks
    if (status === 'available') {
      for (const existing of existingRecords || []) {
        if (existing.status === 'not_available' && rangesOverlap(existing.date, existing.end_date, effectiveStartDate, effectiveEndDate)) {
          console.log(`[Update Room API] Splitting existing not_available record: ${existing.date} to ${existing.end_date}`);
          
          // Mark for deletion
          recordsToDelete.push(existing.id);

          // Get the non-overlapping parts (outside the new available range)
          const splitParts = splitRange(existing.date, existing.end_date, effectiveStartDate, effectiveEndDate, existing);

          console.log(`[Update Room API] Split result: ${splitParts.length} parts to re-insert`);

          // Queue the split parts for re-insertion
          for (const part of splitParts) {
            const partRecord: any = {
              id: existing.id.substring(0, 8) + Math.random().toString(36).substring(2, 12),
              property_id: propertyId,
              room_id: roomId,
              date: part.start,
              end_date: part.end,
              status: part.data.status,
              reason: part.data.reason || null,
              reason_details: part.data.reason_details || null,
              notes: part.data.notes || null,
              occupancy: part.data.occupancy || 1,
              min_nights: part.data.min_nights || 1,
              updated_at: new Date().toISOString(),
            };

            recordsToInsert.push(partRecord);
            console.log(`[Update Room API] Queued split part: ${part.start} to ${part.end}`);
          }
        }
      }
    }

    // ✅ STEP 3: Build the new availability record (use merged dates if blocking)
    const newId = `room_${roomId}_${mergedBlockStart}_${Math.random().toString(36).substring(2, 12)}`;
    const newRecord: any = {
      id: newId,
      property_id: propertyId,
      room_id: roomId,
      room_type_id: roomTypeId || null,
      date: mergedBlockStart,
      end_date: mergedBlockEnd,
      status: status === 'available' ? 'available' : 'not_available',
      reason: reason || null,
      reason_details: reasonDetails || null,
      notes: notes || null,
      occupancy: 1,
      min_nights: 1,
      updated_at: new Date().toISOString(),
    };

    recordsToInsert.push(newRecord);
    
    if (status === 'not_available') {
      console.log(`[Update Room API] Added new not_available block (merged): ${mergedBlockStart} to ${mergedBlockEnd} with reason: ${reason}, merged from ${overlappingNotAvailable.length} existing blocks`);
    } else {
      console.log(`[Update Room API] Added new availability record: ${mergedBlockStart} to ${mergedBlockEnd} with status ${status}`);
    }

    // ✅ STEP 4: Delete old overlapping records
    if (recordsToDelete.length > 0) {
      console.log(`[Update Room API] Deleting ${recordsToDelete.length} overlapping records...`);
      const { error: deleteError, count: deletedCount } = await supabase
        .from('availability_calendar')
        .delete()
        .in('id', recordsToDelete);

      if (deleteError) {
        console.error('[Update Room API] Delete error:', deleteError);
        throw new Error(`Failed to delete overlapping records: ${deleteError.message}`);
      }

      console.log(`[Update Room API] ✓ Deleted ${deletedCount} records`);
    }

    // ✅ STEP 5: Insert all new records (split parts + new availability)
    if (recordsToInsert.length > 0) {
      console.log(`[Update Room API] Inserting ${recordsToInsert.length} records...`);
      
      const { error: insertError, data: insertedData } = await supabase
        .from('availability_calendar')
        .insert(recordsToInsert)
        .select();

      if (insertError) {
        console.error('[Update Room API] Insert error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
        });
        throw new Error(`Failed to insert availability records: ${insertError.message}`);
      }

      console.log(`[Update Room API] ✓ Inserted ${insertedData?.length || 0} records`);
    }

    console.log('[Update Room API] Successfully updated room availability:', {
      propertyId,
      roomId,
      dateRange: `${mergedBlockStart} to ${mergedBlockEnd}`,
      status,
      mergedWith: overlappingNotAvailable.length,
      recordsDeleted: recordsToDelete.length,
      recordsInserted: recordsToInsert.length,
    });

    return NextResponse.json({
      success: true,
      data: recordsToInsert,
      recordsDeleted: recordsToDelete.length,
      recordsInserted: recordsToInsert.length,
      message: status === 'not_available' 
        ? `Block created/merged for ${mergedBlockStart} to ${mergedBlockEnd}` 
        : `Room availability updated for ${mergedBlockStart} to ${mergedBlockEnd} to ${status}`,
    });
  } catch (error) {
    console.error('[Update Room API] Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
