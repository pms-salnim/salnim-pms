import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Simple availability update API
 * - Accepts a date range and status
 * - Deletes any overlapping records
 * - Inserts new record with the range
 * - No complex splitting logic
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, roomId, startDate, endDate, status } = body;

    console.log(`[Update Availability API] Received request:`, {
      propertyId,
      roomId,
      dateRange: `${startDate} to ${endDate}`,
      status,
    });

    if (!propertyId || !roomId || !startDate || !endDate || !status) {
      console.error('[Update Availability API] Missing required fields');
      return NextResponse.json(
        {
          error: 'propertyId, roomId, startDate, endDate, and status are required',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    console.log(`[Update Availability API] Deleting overlapping records for room ${roomId}...`);

    // ✅ STEP 1: Delete all overlapping records for this room
    // This ensures no duplicate key constraint violations
    const { error: deleteError, count: deletedCount } = await supabase
      .from('availability_calendar')
      .delete()
      .eq('room_id', roomId)
      .lte('date', endDate)
      .gte('end_date', startDate);

    if (deleteError) {
      console.error('[Update Availability API] Delete error:', deleteError);
      return NextResponse.json(
        {
          error: 'Failed to delete overlapping records',
          message: deleteError.message,
        },
        { status: 500 }
      );
    }

    console.log(`[Update Availability API] Deleted ${deletedCount || 0} overlapping records`);

    // ✅ STEP 2: Insert new record
    const newRecord = {
      id: randomUUID(),
      property_id: propertyId,
      room_id: roomId,
      date: startDate,
      end_date: endDate,
      status: status === 'available' ? 'available' : 'not_available',
      occupancy: 1,
      min_nights: 1,
      updated_at: new Date().toISOString(),
    };

    console.log(`[Update Availability API] Inserting new record:`, {
      roomId,
      date: startDate,
      end_date: endDate,
      status,
    });

    const { data: insertedData, error: insertError } = await supabase
      .from('availability_calendar')
      .insert(newRecord)
      .select();

    if (insertError) {
      console.error('[Update Availability API] Insert error:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to insert new availability record',
          message: insertError.message,
          code: insertError.code,
        },
        { status: 500 }
      );
    }

    console.log(`[Update Availability API] ✅ Successfully updated availability`);

    return NextResponse.json({
      success: true,
      message: `✅ Updated availability for ${roomId} from ${startDate} to ${endDate} (${status})`,
      data: {
        recordsDeleted: deletedCount || 0,
        recordsCreated: 1,
        newRecord: insertedData?.[0],
      },
    });
  } catch (error: any) {
    console.error('[Update Availability API] Exception:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to update availability',
        message: error?.message,
      },
      { status: 500 }
    );
  }
}
