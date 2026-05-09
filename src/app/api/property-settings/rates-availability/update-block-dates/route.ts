import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to check if two date ranges overlap
function rangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return !(start1 > end2 || end1 < start2);
}

/**
 * POST /api/property-settings/rates-availability/update-block-dates
 * 
 * Updates the date range of an existing block. If the new range overlaps with other blocks,
 * all overlapping blocks are merged into a single continuous block.
 * 
 * Request body:
 * {
 *   propertyId: string,
 *   roomId: string,
 *   roomTypeId?: string (optional room type ID),
 *   currentStartDate: string (current date of the block, for finding the record),
 *   newStartDate: string (new start date),
 *   newEndDate: string (new end date),
 *   reason?: string (optional reason: maintenance, owner_stay, stop_sell, out_of_service, other),
 *   reasonDetails?: string (optional custom details when reason = other),
 *   notes?: string (optional notes)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { propertyId, roomId, roomTypeId, currentStartDate, newStartDate, newEndDate, reason, reasonDetails, notes } = await request.json();

    if (!propertyId || !roomId || !currentStartDate || !newStartDate || !newEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, roomId, currentStartDate, newStartDate, newEndDate' },
        { status: 400 }
      );
    }

    console.log('[Update Block Dates API] Updating block:', {
      propertyId,
      roomId,
      currentStartDate,
      newStartDate,
      newEndDate,
    });

    // ✅ STEP 1: Find the existing not_available block that starts on currentStartDate
    console.log(`[Update Block Dates API] Finding block for room ${roomId} starting on ${currentStartDate}...`);
    
    const { data: existingBlocks, error: fetchError } = await supabase
      .from('availability_calendar')
      .select('*')
      .eq('room_id', roomId)
      .eq('property_id', propertyId)
      .eq('status', 'not_available')
      .eq('date', currentStartDate);

    if (fetchError) {
      console.error('[Update Block Dates API] Fetch error:', fetchError);
      throw new Error(`Failed to fetch block: ${fetchError.message}`);
    }

    if (!existingBlocks || existingBlocks.length === 0) {
      return NextResponse.json(
        { error: 'Block not found', message: `No block found starting on ${currentStartDate}` },
        { status: 404 }
      );
    }

    const existingBlock = existingBlocks[0];
    console.log('[Update Block Dates API] Found block:', {
      id: existingBlock.id,
      currentDate: existingBlock.date,
      currentEndDate: existingBlock.end_date,
    });

    // ✅ STEP 2: If dates haven't actually changed, return success
    if (existingBlock.date === newStartDate && existingBlock.end_date === newEndDate) {
      console.log('[Update Block Dates API] Dates unchanged, returning success');
      return NextResponse.json(
        { success: true, message: 'No changes needed - dates are the same', data: existingBlock },
        { status: 200 }
      );
    }

    // ✅ STEP 3: Fetch all overlapping not_available blocks in the new date range
    console.log(`[Update Block Dates API] Fetching overlapping blocks in new range ${newStartDate} to ${newEndDate}...`);
    
    const { data: overlappingBlocks, error: overlapFetchError } = await supabase
      .from('availability_calendar')
      .select('*')
      .eq('room_id', roomId)
      .eq('property_id', propertyId)
      .eq('status', 'not_available')
      .lte('date', newEndDate)
      .gte('end_date', newStartDate)
      .neq('id', existingBlock.id);

    if (overlapFetchError) {
      console.error('[Update Block Dates API] Error fetching overlapping blocks:', overlapFetchError);
      throw new Error(`Failed to fetch overlapping blocks: ${overlapFetchError.message}`);
    }

    // ✅ STEP 4: Calculate merged date range (min start, max end)
    let mergedStartDate = newStartDate;
    let mergedEndDate = newEndDate;
    const blocksToMerge = [existingBlock, ...(overlappingBlocks || [])];
    const blockIdsToDelete = [existingBlock.id];

    for (const block of overlappingBlocks || []) {
      blockIdsToDelete.push(block.id);
      if (block.date < mergedStartDate) {
        mergedStartDate = block.date;
      }
      if (block.end_date > mergedEndDate) {
        mergedEndDate = block.end_date;
      }
      console.log(`[Update Block Dates API] Including overlapping block in merge: ${block.date} to ${block.end_date}`);
    }

    console.log(`[Update Block Dates API] Merged date range: ${mergedStartDate} to ${mergedEndDate} (${overlappingBlocks?.length || 0} additional blocks merged)`);

    // ✅ STEP 5: Delete all overlapping blocks
    if (blockIdsToDelete.length > 0) {
      console.log(`[Update Block Dates API] Deleting ${blockIdsToDelete.length} blocks...`);
      
      const { error: deleteError, count: deletedCount } = await supabase
        .from('availability_calendar')
        .delete()
        .in('id', blockIdsToDelete);

      if (deleteError) {
        console.error('[Update Block Dates API] Delete error:', deleteError);
        throw new Error(`Failed to delete overlapping blocks: ${deleteError.message}`);
      }

      console.log(`[Update Block Dates API] ✅ Deleted ${deletedCount} blocks`);
    }

    // ✅ STEP 6: Create merged block with new dates
    console.log(`[Update Block Dates API] Creating merged block from ${mergedStartDate} to ${mergedEndDate}...`);
    
    const mergedBlockId = `room_${roomId}_${mergedStartDate}_${Math.random().toString(36).substring(2, 12)}`;
    const mergedBlock: any = {
      id: mergedBlockId,
      property_id: propertyId,
      room_id: roomId,
      room_type_id: roomTypeId || existingBlock.room_type_id || null,
      date: mergedStartDate,
      end_date: mergedEndDate,
      status: 'not_available',
      reason: reason || existingBlock.reason || null,
      reason_details: reasonDetails || existingBlock.reason_details || null,
      notes: notes || existingBlock.notes || null,
      occupancy: existingBlock.occupancy || 1,
      min_nights: existingBlock.min_nights || 1,
      updated_at: new Date().toISOString(),
    };

    const { error: insertError, data: insertedData } = await supabase
      .from('availability_calendar')
      .insert([mergedBlock])
      .select();

    if (insertError) {
      console.error('[Update Block Dates API] Insert error:', insertError);
      throw new Error(`Failed to create merged block: ${insertError.message}`);
    }

    console.log('[Update Block Dates API] ✅ Merged block created successfully:', {
      id: mergedBlockId,
      startDate: mergedStartDate,
      endDate: mergedEndDate,
      mergedBlocksCount: blocksToMerge.length,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Block${overlappingBlocks && overlappingBlocks.length > 0 ? 's merged' : ' updated'} successfully`,
        data: insertedData?.[0],
        oldDates: { start: existingBlock.date, end: existingBlock.end_date },
        newDates: { start: mergedStartDate, end: mergedEndDate },
        mergedBlocksCount: blocksToMerge.length - 1,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Update Block Dates API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to update block dates', details: errorMessage },
      { status: 500 }
    );
  }
}
