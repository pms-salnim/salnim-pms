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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      propertyId, 
      roomTypeId, 
      ratePlanId, 
      date, 
      endDate,
      overrideType, 
      overrideValue,
      derivePricing,
    } = body;

    console.log('[Rate Override API] Request received:', {
      propertyId,
      roomTypeId,
      ratePlanId,
      date,
      endDate,
      overrideType,
      overrideValue,
    });

    if (!propertyId || !roomTypeId || !ratePlanId || !date) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: propertyId, roomTypeId, ratePlanId, date',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (overrideType && !['fixed', 'percentage'].includes(overrideType)) {
      return NextResponse.json(
        { error: 'Invalid overrideType. Must be "fixed" or "percentage"' },
        { status: 400 }
      );
    }

    // Calculate effective end date
    let effectiveEndDate = endDate;
    if (!effectiveEndDate) {
      const today = new Date();
      const fiveYearsLater = new Date(today.getFullYear() + 5, 11, 31);
      const year = fiveYearsLater.getFullYear();
      const month = String(fiveYearsLater.getMonth() + 1).padStart(2, '0');
      const day = String(fiveYearsLater.getDate()).padStart(2, '0');
      effectiveEndDate = `${year}-${month}-${day}`;
    }

    console.log(`[Rate Override API] Processing: room_type_id=${roomTypeId}, rate_plan_id=${ratePlanId}, dates: ${date} to ${effectiveEndDate}`);

    // ✅ STEP 1: FETCH all overlapping rate overrides for this room_type_id
    console.log(`[Rate Override API] Fetching overlapping rate overrides...`);
    
    const { data: existingRecords, error: fetchError } = await supabase
      .from('rate_overrides')
      .select('*')
      .eq('room_type_id', roomTypeId)
      .eq('property_id', propertyId)
      .lte('date', effectiveEndDate)
      .gte('end_date', date);

    if (fetchError) {
      console.error('[Rate Override API] Fetch error:', fetchError);
      throw new Error(`Failed to fetch overlapping rate overrides: ${fetchError.message}`);
    }

    console.log(`[Rate Override API] Found ${existingRecords?.length || 0} overlapping rate records for this room type`);

    // Filter to only records for this specific rate plan
    const relevantRecords = (existingRecords || []).filter(record => {
      if (!record.rate_plan_ids) return false;
      try {
        const planIds = JSON.parse(record.rate_plan_ids);
        return Array.isArray(planIds) && planIds.includes(ratePlanId);
      } catch {
        return record.rate_plan_ids === ratePlanId;
      }
    });

    console.log(`[Rate Override API] Found ${relevantRecords.length} overlapping records for rate plan ${ratePlanId}`);

    // ✅ STEP 2: Process overlapping records - split and collect for re-insertion
    const recordsToDelete: string[] = [];
    const recordsToInsert: any[] = [];

    for (const existing of relevantRecords) {
      const existStart = existing.date;
      const existEnd = existing.end_date;

      // Check if this record actually overlaps
      if (rangesOverlap(existStart, existEnd, date, effectiveEndDate)) {
        console.log(`[Rate Override API] Splitting existing rate record: ${existStart} to ${existEnd}`);
        
        // Mark this record for deletion
        recordsToDelete.push(existing.id);

        // Get the non-overlapping parts
        const splitParts = splitRange(existStart, existEnd, date, effectiveEndDate, existing);

        console.log(`[Rate Override API] Split result: ${splitParts.length} parts to re-insert`);

        // Queue the split parts for re-insertion
        for (const part of splitParts) {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const idInfo = `${propertyId}|${part.start}|${part.end}|${roomTypeId}|${ratePlanId}|${timestamp}|${randomSuffix}`;
          const msgBuffer = new TextEncoder().encode(idInfo);
          const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const partId = hashHex.substring(0, 50);

          const partRecord: any = {
            id: partId,
            property_id: propertyId,
            room_type_id: roomTypeId,
            date: part.start,
            end_date: part.end,
            override_type: part.data.override_type,
            override_value: part.data.override_value,
            derive_pricing: part.data.derive_pricing || false,
            rate_plan_ids: part.data.rate_plan_ids,
          };

          recordsToInsert.push(partRecord);
          console.log(`[Rate Override API] Queued split part: ${part.start} to ${part.end}`);
        }
      }
    }

    // ✅ STEP 3: Generate ID for the new rate record
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const idInfo = `${propertyId}|${date}|${effectiveEndDate}|${roomTypeId}|${ratePlanId}|${timestamp}|${randomSuffix}`;
    const msgBuffer = new TextEncoder().encode(idInfo);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const newId = hashHex.substring(0, 50);

    // ✅ STEP 4: Build the new rate record
    const newRecord: any = {
      id: newId,
      property_id: propertyId,
      room_type_id: roomTypeId,
      date: date,
      end_date: effectiveEndDate,
      override_type: overrideType || null,
      override_value: overrideValue || null,
      derive_pricing: derivePricing || false,
      rate_plan_ids: JSON.stringify([ratePlanId]),
    };

    recordsToInsert.push(newRecord);
    console.log(`[Rate Override API] Added new rate record: ${date} to ${effectiveEndDate} for rate plan ${ratePlanId}`);

    // ✅ STEP 5: Delete old overlapping rate records
    if (recordsToDelete.length > 0) {
      console.log(`[Rate Override API] Deleting ${recordsToDelete.length} old rate records...`);
      const { error: deleteError, count: deletedCount } = await supabase
        .from('rate_overrides')
        .delete()
        .in('id', recordsToDelete);

      if (deleteError) {
        console.error('[Rate Override API] Delete error:', deleteError);
        throw new Error(`Failed to delete overlapping rate records: ${deleteError.message}`);
      }

      console.log(`[Rate Override API] ✓ Deleted ${deletedCount} rate records`);
    }

    // ✅ STEP 6: Insert all new records (split parts + new rate)
    if (recordsToInsert.length > 0) {
      console.log(`[Rate Override API] Inserting ${recordsToInsert.length} rate records...`);
      
      const { error: insertError, data: insertedData } = await supabase
        .from('rate_overrides')
        .insert(recordsToInsert)
        .select();

      if (insertError) {
        console.error('[Rate Override API] Insert error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        });
        throw new Error(`Failed to insert rate records: ${insertError.message}`);
      }

      console.log(`[Rate Override API] ✓ Inserted ${insertedData?.length || 0} rate records`);
    }

    console.log('[Rate Override API] Successfully updated rate override:', {
      propertyId,
      roomTypeId,
      ratePlanId,
      dateRange: `${date} to ${effectiveEndDate}`,
      overrideType,
      overrideValue,
      recordsDeleted: recordsToDelete.length,
      recordsInserted: recordsToInsert.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Rate override saved successfully with automatic range splitting',
      data: recordsToInsert,
      recordsDeleted: recordsToDelete.length,
      recordsInserted: recordsToInsert.length,
    });
  } catch (error) {
    console.error('[Rate Override API] Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
