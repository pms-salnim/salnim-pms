import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/property-settings/rates-availability/delete-block
 * 
 * Removes a stop sell (not_available) block for a room on a specific date.
 * The date parameter is used to find the block that contains that date,
 * and the entire block is removed, making the room available again.
 */
export async function POST(request: NextRequest) {
  try {
    const { propertyId, roomId, date } = await request.json();

    if (!propertyId || !roomId || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, roomId, date' },
        { status: 400 }
      );
    }

    console.log('[Delete Block API] Attempting to delete block:', { propertyId, roomId, date });

    // ✅ STEP 1: Find the block that contains this date
    console.log(`[Delete Block API] Finding block for room ${roomId} on date ${date}...`);
    
    const { data: existingRecords, error: fetchError } = await supabase
      .from('availability_calendar')
      .select('*')
      .eq('room_id', roomId)
      .eq('property_id', propertyId)
      .eq('status', 'not_available')
      .lte('date', date)
      .gte('end_date', date);

    if (fetchError) {
      console.error('[Delete Block API] Fetch error:', fetchError);
      throw new Error(`Failed to fetch block records: ${fetchError.message}`);
    }

    if (!existingRecords || existingRecords.length === 0) {
      console.log('[Delete Block API] No block found for this date');
      return NextResponse.json(
        { error: 'No block found to delete for this date', message: 'This date is not currently blocked' },
        { status: 404 }
      );
    }

    const blockToDelete = existingRecords[0];
    console.log('[Delete Block API] Found block:', {
      id: blockToDelete.id,
      date: blockToDelete.date,
      end_date: blockToDelete.end_date,
    });

    // ✅ STEP 2: Delete the block
    console.log(`[Delete Block API] Deleting block ${blockToDelete.id}...`);
    const { error: deleteError } = await supabase
      .from('availability_calendar')
      .delete()
      .eq('id', blockToDelete.id);

    if (deleteError) {
      console.error('[Delete Block API] Delete error:', deleteError);
      throw new Error(`Failed to delete block: ${deleteError.message}`);
    }

    console.log(`[Delete Block API] ✅ Block deleted successfully`);

    return NextResponse.json(
      {
        success: true,
        message: 'Block removed successfully - room is now available',
        deletedBlock: {
          id: blockToDelete.id,
          date: blockToDelete.date,
          end_date: blockToDelete.end_date,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Delete Block API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to delete block', details: errorMessage },
      { status: 500 }
    );
  }
}
