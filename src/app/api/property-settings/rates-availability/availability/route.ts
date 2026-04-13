import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET availability for a date range
// POST create/upsert availability
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

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}

// POST: Create or update availability (bridge to Supabase Edge Function)
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
    // STEP 2: Verify user authentication (optional - add your logic)
    // ====================================================================
    
    const supabase = createClient()
    // Uncomment if you want to verify authentication:
    // const { data: { user } } = await supabase.auth.getUser()
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // ====================================================================
    // STEP 3: Forward to Supabase Edge Function
    // ====================================================================
    
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          code: 'SERVER_CONFIG_ERROR',
        },
        { status: 500 }
      )
    }

    console.log(`[Availability API] Forwarding to edge function: ${availabilities.length} updates for property ${propertyId}`)
    console.log('[Availability API] Payload:', JSON.stringify({ propertyId, availabilities }, null, 2))

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/save-availability`
    let response;
    let result;
    
    try {
      response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ propertyId, availabilities }),
      })

      result = await response.json()
    } catch (fetchError) {
      console.error('[Availability API] Fetch error:', fetchError)
      return NextResponse.json(
        {
          error: 'Failed to connect to edge function',
          code: 'EDGE_FUNCTION_ERROR',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        { status: 500 }
      )
    }

    // ====================================================================
    // STEP 4: Handle response from edge function
    // ====================================================================

    if (!response.ok) {
      console.error(`[Availability API] Edge function returned error:`, {
        status: response.status,
        statusText: response.statusText,
        body: result,
      })
      
      // Pass through the error response (already properly formatted)
      return NextResponse.json(result, { status: response.status })
    }

    console.log(`[Availability API] Success: Updated ${result.data?.recordsUpserted || 0} records`)

    // ====================================================================
    // STEP 5: Return success response
    // ====================================================================
    
    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('[Availability API] Unexpected error:', error)
    
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
