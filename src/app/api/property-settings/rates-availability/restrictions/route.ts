import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET restrictions for a property
// POST create a new restriction
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('restrictions')
      .select('*')
      .eq('property_id', propertyId)
      .order('date_range_start', { ascending: true });

    if (type) query = query.eq('restriction_type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restrictions' },
      { status: 500 }
    );
  }
}

// POST: Create a new restriction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      restrictionType,
      roomTypeId,
      roomId,
      dateRangeStart,
      dateRangeEnd,
      daysOfWeek,
      value,
      discountPercentage,
      appliedAtLevel,
    } = body;

    if (!propertyId || !name || !restrictionType) {
      return NextResponse.json(
        { error: 'propertyId, name, and restrictionType are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Generate ID
    const id = Buffer.from(`${propertyId}|${name}|${Date.now()}`).toString('base64').substring(0, 50);

    const { data, error } = await supabase
      .from('restrictions')
      .insert([
        {
          id,
          property_id: propertyId,
          name,
          description,
          restriction_type: restrictionType,
          room_type_id: roomTypeId || null,
          room_id: roomId || null,
          date_range_start: dateRangeStart || null,
          date_range_end: dateRangeEnd || null,
          days_of_week: daysOfWeek || null,
          value: value || null,
          discount_percentage: discountPercentage || null,
          applied_at_level: appliedAtLevel || 'property',
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating restriction:', error);
    return NextResponse.json(
      { error: 'Failed to create restriction' },
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
