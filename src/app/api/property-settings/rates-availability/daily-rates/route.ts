import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET daily rates for a property within a date range
// POST create/upsert daily rates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const roomTypeId = searchParams.get('roomTypeId');
    const roomId = searchParams.get('roomId');
    const ratePlanId = searchParams.get('ratePlanId');

    if (!propertyId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'propertyId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('daily_rates')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (roomTypeId) query = query.eq('room_type_id', roomTypeId);
    if (roomId) query = query.eq('room_id', roomId);
    if (ratePlanId) query = query.eq('rate_plan_id', ratePlanId);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching daily rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily rates' },
      { status: 500 }
    );
  }
}

// POST: Create or update daily rates (single or bulk)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, ratePlanId, rates } = body;

    if (!propertyId || !ratePlanId || !rates || !Array.isArray(rates)) {
      return NextResponse.json(
        { error: 'propertyId, ratePlanId, and rates array are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Prepare upsert data with generated IDs
    const upsertData = rates.map((rate: any) => {
      const idParts = [
        propertyId,
        ratePlanId,
        rate.date,
        rate.roomId || 'null',
        rate.roomTypeId || 'null',
      ];
      const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

      return {
        id,
        property_id: propertyId,
        rate_plan_id: ratePlanId,
        date: rate.date,
        base_price: rate.basePrice,
        occupancy_price: rate.occupancyPrice || 0,
        room_type_id: rate.roomTypeId || null,
        room_id: rate.roomId || null,
        applied_at_level: rate.appliedAtLevel || 'property',
      };
    });

    const { data, error } = await supabase
      .from('daily_rates')
      .upsert(upsertData)
      .select();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating daily rates:', error);
    return NextResponse.json(
      { error: 'Failed to create/update daily rates' },
      { status: 500 }
    );
  }
}

// PUT: Update daily rates
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rateId, basePrice, occupancyPrice } = body;

    if (!rateId) {
      return NextResponse.json(
        { error: 'rateId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('daily_rates')
      .update({
        base_price: basePrice,
        occupancy_price: occupancyPrice,
      })
      .eq('id', rateId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating daily rate:', error);
    return NextResponse.json(
      { error: 'Failed to update daily rate' },
      { status: 500 }
    );
  }
}

// DELETE: Delete daily rates
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { rateIds } = body;

    if (!rateIds || !Array.isArray(rateIds) || rateIds.length === 0) {
      return NextResponse.json(
        { error: 'rateIds array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('daily_rates')
      .delete()
      .in('id', rateIds);

    if (error) throw error;

    return NextResponse.json({ message: 'Daily rates deleted successfully' });
  } catch (error) {
    console.error('Error deleting daily rates:', error);
    return NextResponse.json(
      { error: 'Failed to delete daily rates' },
      { status: 500 }
    );
  }
}
