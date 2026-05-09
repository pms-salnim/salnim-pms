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

// GET restrictions for a property
// Fetches from availability_restrictions table (room-type-level and room-level restrictions)
// Security: Protected by authentication middleware - only authenticated users can call this
// The propertyId parameter is validated at the page component level
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    console.log('[API] Restrictions endpoint called with propertyId:', propertyId);

    if (!propertyId) {
      console.error('[API] Missing propertyId parameter');
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    console.log('[API] Creating Supabase client...');
    const supabase = createClient();
    console.log('[API] Supabase client created successfully');

    // Fetch restrictions from availability_restrictions table
    // Get room-type-level restrictions (room_id IS NULL, room_type_id IS NOT NULL)
    console.log('[API] Building query for availability_restrictions table...');

    const query = supabase
      .from('availability_restrictions')
      .select('room_type_id, room_id, min_nights, max_nights, date, end_date, close_to_arrival, close_to_departure')
      .eq('property_id', propertyId);

    console.log('[API] Query created, executing...');
    
    const { data, error } = await query;

    console.log('[API] Query executed');

    if (error) {
      console.error('[API] Supabase query error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    // Filter for records that have restrictions (min/max/CTA/CTD set)
    const filteredData = (data || []).filter((item: any) => 
      item.min_nights !== null || item.max_nights !== null || item.close_to_arrival || item.close_to_departure
    );

    console.log(`[API] Successfully fetched ${filteredData?.length || 0} restrictions (from ${data?.length || 0} total) for property ${propertyId}`);

    return NextResponse.json({ 
      data: filteredData || [],
      count: filteredData?.length || 0,
    });
  } catch (error: any) {
    console.error('[API] Restrictions endpoint error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch restrictions',
        message: error?.message,
        code: error?.code,
      },
      { status: 500 }
    );
  }
}

// POST: Bulk update restrictions with automatic range splitting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, restrictions } = body;

    console.log(`[Restrictions API] Received request:`, { propertyId, restrictionCount: restrictions?.length });
    console.log(`[Restrictions API] Sample restriction:`, restrictions?.[0]);

    if (!propertyId || !restrictions || !Array.isArray(restrictions)) {
      console.error('[Restrictions API] Invalid request - missing propertyId or restrictions:', { propertyId: !!propertyId, restrictions: !!restrictions, isArray: Array.isArray(restrictions) });
      return NextResponse.json(
        { 
          error: 'propertyId and restrictions array are required',
          code: 'INVALID_REQUEST',
          received: { propertyId: !!propertyId, restrictions: !!restrictions, isArray: Array.isArray(restrictions) },
        },
        { status: 400 }
      );
    }

    if (restrictions.length === 0) {
      console.error('[Restrictions API] Empty restrictions array');
      return NextResponse.json(
        { 
          error: 'restrictions array cannot be empty',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const supabase = createClient();
    let totalRecordsUpserted = 0;
    const errors: any[] = [];

    console.log(`[Restrictions API] Processing ${restrictions.length} restriction updates for property ${propertyId}`);

    // ====================================================================
    // PROCESS EACH RESTRICTION UPDATE WITH RANGE SPLITTING
    // ====================================================================

    for (const restriction of restrictions) {
      try {
        const {
          roomTypeId,
          date: startDate,
          endDate,
          minStay,
          maxStay,
          closeToArrival,
          closeToDeparture,
          appliedDays,
        } = restriction;

        console.log(`[Restrictions API] Processing restriction record:`, { roomTypeId, startDate, minStay, maxStay, closeToArrival, closeToDeparture });

        if (!roomTypeId || !startDate) {
          console.warn('[Restrictions API] Skipping restriction with missing roomTypeId or date', { roomTypeId, startDate, fullRecord: restriction });
          errors.push({
            roomTypeId,
            date: startDate,
            error: `Missing ${!roomTypeId ? 'roomTypeId' : 'date'} in restriction record`,
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

        console.log(`[Restrictions API] Processing: room_type_id=${roomTypeId}, dates: ${startDate} to ${effectiveEndDate}`);

        // ✅ STEP 1: FETCH all overlapping restrictions for this room_type_id
        console.log(`[Restrictions API] Fetching overlapping restrictions...`);
        
        const { data: existingRecords, error: fetchError } = await supabase
          .from('availability_restrictions')
          .select('*')
          .eq('room_type_id', roomTypeId)
          .eq('property_id', propertyId)
          .lte('date', effectiveEndDate)
          .gte('end_date', startDate);

        if (fetchError) {
          console.error('[Restrictions API] Fetch error:', fetchError);
          throw new Error(`Failed to fetch overlapping restrictions: ${fetchError.message}`);
        }

        console.log(`[Restrictions API] Found ${existingRecords?.length || 0} overlapping restrictions`);

        // ✅ STEP 2: Process overlapping records - split and collect for re-insertion
        const recordsToDelete: string[] = [];
        const recordsToInsert: any[] = [];

        for (const existing of existingRecords || []) {
          const existStart = existing.date;
          const existEnd = existing.end_date;

          // Check if this record actually overlaps
          if (rangesOverlap(existStart, existEnd, startDate, effectiveEndDate)) {
            console.log(`[Restrictions API] Splitting existing restriction: ${existStart} to ${existEnd}`);
            
            // Mark this record for deletion
            recordsToDelete.push(existing.id);

            // Get the non-overlapping parts
            const splitParts = splitRange(existStart, existEnd, startDate, effectiveEndDate, existing);

            console.log(`[Restrictions API] Split result: ${splitParts.length} parts to re-insert`);

            // Queue the split parts for re-insertion
            for (const part of splitParts) {
              const timestamp = Date.now();
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              const idInfo = `${propertyId}|${part.start}|${part.end}|${roomTypeId}|${timestamp}|${randomSuffix}`;
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
                min_nights: part.data.min_nights,
                max_nights: part.data.max_nights,
                close_to_arrival: part.data.close_to_arrival,
                close_to_departure: part.data.close_to_departure,
              };

              // Preserve applied_days if it exists in the original record
              if (part.data.applied_days !== undefined && part.data.applied_days !== null) {
                partRecord.applied_days = part.data.applied_days;
              }

              recordsToInsert.push(partRecord);
              console.log(`[Restrictions API] Queued split part: ${part.start} to ${part.end}`);
            }
          }
        }

        // ✅ STEP 3: Generate ID for the new restriction
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const idInfo = `${propertyId}|${startDate}|${effectiveEndDate}|${roomTypeId}|${timestamp}|${randomSuffix}`;
        const msgBuffer = new TextEncoder().encode(idInfo);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const newId = hashHex.substring(0, 50);

        // ✅ STEP 4: Build the new restriction record
        const newRecord: any = {
          id: newId,
          property_id: propertyId,
          room_type_id: roomTypeId,
          date: startDate,
          end_date: effectiveEndDate,
          min_nights: minStay || null,
          max_nights: maxStay || null,
          close_to_arrival: closeToArrival || false,
          close_to_departure: closeToDeparture || false,
        };

        // ✅ NEW: Include applied_days if provided
        if (appliedDays !== undefined && appliedDays !== null && Array.isArray(appliedDays)) {
          newRecord.applied_days = appliedDays;
        }

        recordsToInsert.push(newRecord);
        console.log(`[Restrictions API] Added new restriction: ${startDate} to ${effectiveEndDate}`);

        // ✅ STEP 5: Delete old overlapping restrictions
        if (recordsToDelete.length > 0) {
          console.log(`[Restrictions API] Deleting ${recordsToDelete.length} old restrictions...`);
          const { error: deleteError, count: deletedCount } = await supabase
            .from('availability_restrictions')
            .delete()
            .in('id', recordsToDelete);

          if (deleteError) {
            console.error('[Restrictions API] Delete error:', deleteError);
            throw new Error(`Failed to delete overlapping restrictions: ${deleteError.message}`);
          }

          console.log(`[Restrictions API] ✓ Deleted ${deletedCount} restrictions`);
        }

        // ✅ STEP 6: Insert all new records (split parts + new restriction)
        if (recordsToInsert.length > 0) {
          console.log(`[Restrictions API] Inserting ${recordsToInsert.length} restrictions...`);
          console.log(`[Restrictions API] Sample record to insert:`, recordsToInsert[0]);
          
          const { error: insertError, data: insertedData } = await supabase
            .from('availability_restrictions')
            .insert(recordsToInsert)
            .select();

          if (insertError) {
            console.error('[Restrictions API] Insert error:', {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
            });
            throw new Error(`Failed to insert restrictions: ${insertError.message}`);
          }

          console.log(`[Restrictions API] ✓ Inserted ${insertedData?.length || 0} restrictions`);
          totalRecordsUpserted += (insertedData?.length || 0);
        }

      } catch (recordError: any) {
        console.error(`[Restrictions API] Error processing restriction record:`, recordError);
        errors.push({
          roomTypeId: restriction.roomTypeId,
          date: restriction.date,
          error: recordError.message,
        });
      }
    }

    console.log(`[Restrictions API] Successfully processed ${totalRecordsUpserted} restriction records`, { 
      totalProcessed: restrictions.length,
      totalErrors: errors.length,
      errors: errors.length > 0 ? errors : undefined 
    });

    // Return 400 only if ALL records failed, not if some failed
    const hasAllFailed = totalRecordsUpserted === 0 && errors.length > 0;
    const statusCode = hasAllFailed ? 400 : 200;

    return NextResponse.json({
      data: {
        recordsUpserted: totalRecordsUpserted,
        totalProcessed: restrictions.length,
        message: totalRecordsUpserted > 0 
          ? `Updated ${totalRecordsUpserted} restriction records${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
          : 'No records were updated',
        errors: errors.length > 0 ? errors : undefined,
      },
    }, { status: statusCode });

  } catch (error) {
    console.error('[Restrictions API] Error processing restrictions:', error);
    return NextResponse.json(
      {
        error: 'Failed to process restrictions',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT: Update a restriction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { restrictionId, name, description, status, value, discountPercentage } = body;

    if (!restrictionId) {
      return NextResponse.json(
        { error: 'restrictionId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (value !== undefined) updateData.value = value;
    if (discountPercentage !== undefined) updateData.discount_percentage = discountPercentage;

    const { data, error } = await supabase
      .from('restrictions')
      .update(updateData)
      .eq('id', restrictionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating restriction:', error);
    return NextResponse.json(
      { error: 'Failed to update restriction' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a restriction
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { restrictionIds } = body;

    if (!restrictionIds || !Array.isArray(restrictionIds) || restrictionIds.length === 0) {
      return NextResponse.json(
        { error: 'restrictionIds array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('restrictions')
      .delete()
      .in('id', restrictionIds);

    if (error) throw error;

    return NextResponse.json({ message: 'Restrictions deleted successfully' });
  } catch (error) {
    console.error('Error deleting restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to delete restrictions' },
      { status: 500 }
    );
  }
}
