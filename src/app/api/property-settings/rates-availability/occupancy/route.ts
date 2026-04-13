import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET occupancy restrictions for a date range
// POST create/upsert occupancy restrictions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const roomTypeId = searchParams.get('roomTypeId');
    const roomId = searchParams.get('roomId');

    if (!propertyId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'propertyId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('occupancy_restrictions')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (roomTypeId) query = query.eq('room_type_id', roomTypeId);
    if (roomId) query = query.eq('room_id', roomId);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching occupancy restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch occupancy restrictions' },
      { status: 500 }
    );
  }
}

// POST: Create or update occupancy restrictions (single or bulk)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, occupancyData } = body;

    if (!propertyId || !occupancyData || !Array.isArray(occupancyData)) {
      return NextResponse.json(
        { error: 'propertyId and occupancyData array are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Prepare upsert data with generated IDs
    const upsertData = occupancyData.map((occ: any) => {
      const idParts = [
        propertyId,
        occ.date,
        occ.roomId || 'null',
        occ.roomTypeId || 'null',
      ];
      const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

      return {
        id,
        property_id: propertyId,
        date: occ.date,
        min_occupancy: occ.minOccupancy || 1,
        max_occupancy: occ.maxOccupancy || null,
        room_type_id: occ.roomTypeId || null,
        room_id: occ.roomId || null,
        applied_at_level: occ.appliedAtLevel || 'property',
      };
    });

    const { data, error } = await supabase
      .from('occupancy_restrictions')
      .upsert(upsertData)
      .select();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating occupancy restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to create/update occupancy restrictions' },
      { status: 500 }
    );
  }
}

// PUT: Update occupancy restriction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { occupancyId, minOccupancy, maxOccupancy } = body;

    if (!occupancyId) {
      return NextResponse.json(
        { error: 'occupancyId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const updateData: any = {};
    if (minOccupancy !== undefined) updateData.min_occupancy = minOccupancy;
    if (maxOccupancy !== undefined) updateData.max_occupancy = maxOccupancy;

    const { data, error } = await supabase
      .from('occupancy_restrictions')
      .update(updateData)
      .eq('id', occupancyId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating occupancy restriction:', error);
    return NextResponse.json(
      { error: 'Failed to update occupancy restriction' },
      { status: 500 }
    );
  }
}

// DELETE: Delete occupancy restrictions
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { occupancyIds } = body;

    if (!occupancyIds || !Array.isArray(occupancyIds) || occupancyIds.length === 0) {
      return NextResponse.json(
        { error: 'occupancyIds array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('occupancy_restrictions')
      .delete()
      .in('id', occupancyIds);

    if (error) throw error;

    return NextResponse.json({ message: 'Occupancy restrictions deleted successfully' });
  } catch (error) {
    console.error('Error deleting occupancy restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to delete occupancy restrictions' },
      { status: 500 }
    );
  }
}
