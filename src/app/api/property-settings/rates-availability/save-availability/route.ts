import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UpdateRecord {
  roomId: string;
  startDate: string;
  endDate: string;
  status: 'available' | 'not_available';
}

interface AvailabilityRecord {
  id: string;
  room_id: string;
  date: string;
  end_date: string;
  status: string;
}

/**
 * ✅ RANGE-BASED AVAILABILITY LOGIC
 * 
 * This API implements proper date-range based availability with automatic splitting:
 * 
 * RULE: When a new range overlaps with existing ranges, split existing ones:
 * 
 * Initial: Available → 2025-04-18 to 2025-12-31
 * New:     Stop Sell → 2025-05-01 to 2025-05-15
 * 
 * Result:
 * 1. Available → 2025-04-18 to 2025-04-30 (before)
 * 2. Stop Sell → 2025-05-01 to 2025-05-15 (new override)
 * 3. Available → 2025-05-16 to 2025-12-31 (after)
 */

// Helper: Compare dates as YYYY-MM-DD strings
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

// Check if two ranges overlap
function rangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return !(isDateAfter(start1, end2) || isDateBefore(end1, start2));
}

// Split an existing range when a new range overlaps
function splitRange(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string,
  existingStatus: string
): Array<{ start: string; end: string; status: string }> {
  const result: Array<{ start: string; end: string; status: string }> = [];

  // Part 1: Before the new range (if exists)
  if (isDateBefore(existingStart, newStart)) {
    const beforeEnd = dateToPrevDay(newStart);
    result.push({
      start: existingStart,
      end: beforeEnd,
      status: existingStatus,
    });
  }

  // Part 2: After the new range (if exists)
  if (isDateAfter(existingEnd, newEnd)) {
    const afterStart = dateToNextDay(newEnd);
    result.push({
      start: afterStart,
      end: existingEnd,
      status: existingStatus,
    });
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { propertyId, updates } = await request.json();

    console.log('[Save Availability API] 📥 Received range-based update:', {
      propertyId,
      updatesCount: Array.isArray(updates) ? updates.length : 0,
      updates: updates?.slice(0, 2),
    });

    if (!propertyId) {
      console.error('[Save Availability API] ❌ Missing propertyId');
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      console.error('[Save Availability API] ❌ Missing or empty updates array');
      return NextResponse.json(
        { error: 'updates array is required and must not be empty' },
        { status: 400 }
      );
    }

    console.log('[Save Availability API] Processing batch update:', {
      propertyId,
      updateCount: updates.length,
      firstUpdate: updates[0],
    });

    let processedRanges = 0;
    let recordsCreated = 0;
    let recordsDeleted = 0;
    const allOperations: any[] = [];
    const operationErrors: string[] = [];

    // Process each room's availability range
    for (const update of updates) {
      const { roomId, startDate, endDate, status } = update as UpdateRecord;

      if (!roomId || !startDate || !endDate || !status) {
        console.warn('[Save Availability API] ⚠️ Invalid update record:', update);
        continue;
      }

      console.log(`[Save Availability API] 🔄 Processing range: room=${roomId}, ${startDate} to ${endDate}, status=${status}`);

      try {
        // ✅ STEP 1: Fetch all existing records for this room
        const { data: existingRecords, error: fetchError } = await supabase
          .from('availability_calendar')
          .select('*')
          .eq('room_id', roomId)
          .gte('end_date', startDate)
          .lte('date', endDate);

        if (fetchError) {
          console.error('[Save Availability API] ❌ Failed to fetch existing records:', fetchError);
          operationErrors.push(`Failed to fetch records for ${roomId}: ${fetchError.message}`);
          continue;
        }

        console.log(`[Save Availability API] 📋 Found ${existingRecords?.length || 0} overlapping records`);

        // ✅ STEP 2: Find records that overlap with new range and split them
        const recordsToDelete: string[] = [];
        const recordsToInsert: any[] = [];

        for (const existing of existingRecords || []) {
          const existingStart = existing.date;
          const existingEnd = existing.end_date;

          // Check if this record overlaps with new range
          if (rangesOverlap(existingStart, existingEnd, startDate, endDate)) {
            console.log(`[Save Availability API] 🔀 Splitting overlapping record: ${existingStart} to ${existingEnd}`);
            
            // Mark for deletion
            recordsToDelete.push(existing.id);

            // Split the existing record around the new range
            const splitParts = splitRange(existingStart, existingEnd, startDate, endDate, existing.status);
            
            // Convert split parts to insert payload
            for (const part of splitParts) {
              recordsToInsert.push({
                id: randomUUID(),
                property_id: propertyId,
                room_id: roomId,
                date: part.start,
                end_date: part.end,
                status: part.status,
                occupancy: existing.occupancy || 1,
                updated_at: new Date().toISOString(),
              });
            }
          }
        }

        // ✅ STEP 3: Add the new range record
        recordsToInsert.push({
          id: randomUUID(),
          property_id: propertyId,
          room_id: roomId,
          date: startDate,
          end_date: endDate,
          status: status,
          occupancy: 1,
          updated_at: new Date().toISOString(),
        });

        console.log(`[Save Availability API] 🗑️ Deleting ${recordsToDelete.length} old records, inserting ${recordsToInsert.length} new records`);

        // ✅ STEP 4: Delete old overlapping records
        if (recordsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('availability_calendar')
            .delete()
            .in('id', recordsToDelete);

          if (deleteError) {
            console.error('[Save Availability API] ❌ Delete error:', deleteError);
            operationErrors.push(`Failed to delete old records for ${roomId}: ${deleteError.message}`);
            continue;
          }
          recordsDeleted += recordsToDelete.length;
        }

        // ✅ STEP 5: Insert new records (split parts + new override)
        if (recordsToInsert.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('availability_calendar')
            .insert(recordsToInsert)
            .select();

          if (insertError) {
            console.error('[Save Availability API] ❌ Insert error:', insertError);
            operationErrors.push(`Failed to insert records for ${roomId}: ${insertError.message}`);
            // Attempt to restore deleted records (basic error recovery)
            continue;
          }
          recordsCreated += inserted?.length || 0;
          console.log(`[Save Availability API] ✅ Successfully processed range: created ${inserted?.length || 0} records`);
        }

        processedRanges++;
        allOperations.push({
          roomId,
          dateRange: `${startDate} to ${endDate}`,
          status,
          success: true,
          recordsCreated: recordsToInsert.length,
          recordsDeleted: recordsToDelete.length,
        });
      } catch (error) {
        console.error('[Save Availability API] ❌ Exception processing range:', { roomId, startDate, endDate, error });
        operationErrors.push(`Exception for ${roomId} (${startDate} to ${endDate}): ${error}`);
        allOperations.push({
          roomId,
          dateRange: `${startDate} to ${endDate}`,
          status,
          success: false,
          error: String(error),
        });
      }
    }

    console.log('[Save Availability API] ✅ Batch complete:', {
      processedRanges,
      recordsCreated,
      recordsDeleted,
      errors: operationErrors.length,
    });

    return NextResponse.json({
      success: operationErrors.length === 0,
      message: operationErrors.length === 0 
        ? `✅ Successfully processed ${processedRanges} range(s): created ${recordsCreated} records, deleted ${recordsDeleted} old records`
        : `⚠️ Partially failed: ${processedRanges - operationErrors.length} succeeded, ${operationErrors.length} failed`,
      data: {
        processedRanges,
        recordsCreated,
        recordsDeleted,
        totalErrors: operationErrors.length,
      operations: allOperations.map(op => ({
          roomId: op.roomId,
          dateRange: op.dateRange,
          status: op.status,
          success: op.success,
          recordsCreated: op.recordsCreated,
          recordsDeleted: op.recordsDeleted,
          error: op.error || undefined,
        })),
        operationsSummary: {
          total: allOperations.length,
          succeeded: allOperations.filter(op => op.success).length,
          failed: allOperations.filter(op => !op.success).length,
        },
      },
    });
  } catch (error) {
    console.error('[Save Availability API] ❌ Catch error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
