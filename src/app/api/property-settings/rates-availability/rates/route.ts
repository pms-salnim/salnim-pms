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

// POST: Bulk update rate overrides with automatic range splitting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, rates } = body;

    if (!propertyId || !rates || !Array.isArray(rates)) {
      return NextResponse.json(
        { 
          error: 'propertyId and rates array are required',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (rates.length === 0) {
      return NextResponse.json(
        { 
          error: 'rates array cannot be empty',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const supabase = createClient();
    let totalRecordsUpserted = 0;
    const errors: any[] = [];

    console.log(`[Rates API] Processing ${rates.length} rate override updates for property ${propertyId}`);
    console.log(`[Rates API] Sample rate record:`, rates[0]);

    // ====================================================================
    // PROCESS EACH RATE UPDATE WITH RANGE SPLITTING
    // ====================================================================

    for (const rate of rates) {
      try {
        const {
          roomTypeId,
          ratePlanId,
          date: startDate,
          endDate,
          overrideType,
          overrideValue,
          derivePricing,
          appliedDays,
        } = rate;

        console.log(`[Rates API] Processing rate record:`, { roomTypeId, ratePlanId, startDate, overrideType, overrideValue });

        if (!roomTypeId || !ratePlanId || !startDate) {
          console.warn('[Rates API] Skipping rate with missing roomTypeId, ratePlanId, or date', { roomTypeId, ratePlanId, startDate, fullRecord: rate });
          errors.push({
            roomTypeId,
            ratePlanId,
            date: startDate,
            error: `Missing ${!roomTypeId ? 'roomTypeId' : !ratePlanId ? 'ratePlanId' : 'date'} in rate record`,
          });
          continue;
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

        console.log(`[Rates API] Processing: room_type_id=${roomTypeId}, rate_plan_id=${ratePlanId}, dates: ${startDate} to ${effectiveEndDate}`);

        // ✅ STEP 1: FETCH all overlapping rate overrides for this room_type_id AND rate_plan_id
        console.log(`[Rates API] Fetching overlapping rate overrides...`);
        
        const { data: existingRecords, error: fetchError } = await supabase
          .from('rate_overrides')
          .select('*')
          .eq('room_type_id', roomTypeId)
          .eq('property_id', propertyId)
          .lte('date', effectiveEndDate)
          .gte('end_date', startDate);

        if (fetchError) {
          console.error('[Rates API] Fetch error:', fetchError);
          throw new Error(`Failed to fetch overlapping rate overrides: ${fetchError.message}`);
        }

        console.log(`[Rates API] Found ${existingRecords?.length || 0} overlapping rate records for this room type`);

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

        console.log(`[Rates API] Found ${relevantRecords.length} overlapping records for rate plan ${ratePlanId}`);

        // ✅ STEP 2: Process overlapping records - split and collect for re-insertion
        const recordsToDelete: string[] = [];
        const recordsToInsert: any[] = [];

        for (const existing of relevantRecords) {
          const existStart = existing.date;
          const existEnd = existing.end_date;

          // Check if this record actually overlaps
          if (rangesOverlap(existStart, existEnd, startDate, effectiveEndDate)) {
            console.log(`[Rates API] Splitting existing rate record: ${existStart} to ${existEnd}`);
            
            // Mark this record for deletion
            recordsToDelete.push(existing.id);

            // Get the non-overlapping parts
            const splitParts = splitRange(existStart, existEnd, startDate, effectiveEndDate, existing);

            console.log(`[Rates API] Split result: ${splitParts.length} parts to re-insert`);

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

              // Preserve applied_days if it exists in the original record
              if (part.data.applied_days !== undefined && part.data.applied_days !== null) {
                partRecord.applied_days = part.data.applied_days;
              }

              recordsToInsert.push(partRecord);
              console.log(`[Rates API] Queued split part: ${part.start} to ${part.end}`);
            }
          }
        }

        // ✅ STEP 3: Generate ID for the new rate record
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const idInfo = `${propertyId}|${startDate}|${effectiveEndDate}|${roomTypeId}|${ratePlanId}|${timestamp}|${randomSuffix}`;
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
          date: startDate,
          end_date: effectiveEndDate,
          override_type: overrideType || null,
          override_value: overrideValue || null,
          derive_pricing: derivePricing || false,
          rate_plan_ids: JSON.stringify([ratePlanId]),
        };

        // ✅ NEW: Include applied_days if provided
        if (appliedDays !== undefined && appliedDays !== null && Array.isArray(appliedDays)) {
          newRecord.applied_days = appliedDays;
        }

        recordsToInsert.push(newRecord);
        console.log(`[Rates API] Added new rate record: ${startDate} to ${effectiveEndDate} for rate plan ${ratePlanId}`);

        // ✅ STEP 5: Delete old overlapping rate records
        if (recordsToDelete.length > 0) {
          console.log(`[Rates API] Deleting ${recordsToDelete.length} old rate records...`);
          const { error: deleteError, count: deletedCount } = await supabase
            .from('rate_overrides')
            .delete()
            .in('id', recordsToDelete);

          if (deleteError) {
            console.error('[Rates API] Delete error:', deleteError);
            throw new Error(`Failed to delete overlapping rate records: ${deleteError.message}`);
          }

          console.log(`[Rates API] ✓ Deleted ${deletedCount} rate records`);
        }

        // ✅ STEP 6: Insert all new records (split parts + new rate)
        if (recordsToInsert.length > 0) {
          console.log(`[Rates API] Inserting ${recordsToInsert.length} rate records...`);
          console.log(`[Rates API] Sample record to insert:`, recordsToInsert[0]);
          
          const { error: insertError, data: insertedData } = await supabase
            .from('rate_overrides')
            .insert(recordsToInsert)
            .select();

          if (insertError) {
            console.error('[Rates API] Insert error:', {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
            });
            throw new Error(`Failed to insert rate records: ${insertError.message}`);
          }

          console.log(`[Rates API] ✓ Inserted ${insertedData?.length || 0} rate records`);
          totalRecordsUpserted += (insertedData?.length || 0);
        }

      } catch (recordError: any) {
        console.error(`[Rates API] Error processing rate record:`, recordError);
        errors.push({
          roomTypeId: rate.roomTypeId,
          ratePlanId: rate.ratePlanId,
          date: rate.date,
          error: recordError.message,
        });
      }
    }

    console.log(`[Rates API] Successfully processed ${totalRecordsUpserted} rate override records`, { 
      totalProcessed: rates.length,
      totalErrors: errors.length,
      errors: errors.length > 0 ? errors : undefined 
    });

    const hasAllFailed = totalRecordsUpserted === 0 && errors.length > 0;
    const statusCode = hasAllFailed ? 400 : 200;

    return NextResponse.json({
      data: {
        recordsUpserted: totalRecordsUpserted,
        totalProcessed: rates.length,
        message: totalRecordsUpserted > 0 
          ? `Updated ${totalRecordsUpserted} rate override records${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
          : 'No records were updated',
        errors: errors.length > 0 ? errors : undefined,
      },
    }, { status: statusCode });

  } catch (error) {
    console.error('[Rates API] Error processing rate overrides:', error);
    return NextResponse.json(
      {
        error: 'Failed to process rate overrides',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET: Fetch rate overrides for a property from rate_overrides table
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const roomId = searchParams.get('roomId');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('rate_overrides')
      .select('*')
      .eq('property_id', propertyId)
      .order('date', { ascending: true });

    if (startDate && endDate) {
      query = query.lte('date', endDate).gte('date', startDate);
    }

    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching rate overrides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate overrides' },
      { status: 500 }
    );
  }
}

// DELETE: Delete rate override for a specific date/room from rate_overrides table
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, roomId, date } = body;

    if (!propertyId || !roomId || !date) {
      return NextResponse.json(
        { error: 'propertyId, roomId, and date are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Generate the same ID used when the record was created
    const idInfo = `${propertyId}|${date}|${roomId}|null|2031-12-31`;
    const msgBuffer = new TextEncoder().encode(idInfo);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const id = hashHex.substring(0, 50);

    // Delete from rate_overrides table
    const { error } = await supabase
      .from('rate_overrides')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Rate override deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate override:', error);
    return NextResponse.json(
      { error: 'Failed to delete rate override' },
      { status: 500 }
    );
  }
}
