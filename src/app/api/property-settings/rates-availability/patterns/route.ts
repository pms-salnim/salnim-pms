import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET recurring patterns for a property
// POST create a new pattern
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
      .from('recurring_patterns')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (type) query = query.eq('pattern_type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching recurring patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring patterns' },
      { status: 500 }
    );
  }
}

// POST: Create a new recurring pattern
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      patternType,
      roomTypeId,
      roomId,
      daysOfWeek,
      minNights,
      maxNights,
      occupancy,
      priceModifier,
      startDate,
      endDate,
      appliedAtLevel,
    } = body;

    if (!propertyId || !name || !patternType) {
      return NextResponse.json(
        { error: 'propertyId, name, and patternType are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Generate ID
    const id = Buffer.from(`${propertyId}|${name}|${Date.now()}`).toString('base64').substring(0, 50);

    const { data, error } = await supabase
      .from('recurring_patterns')
      .insert([
        {
          id,
          property_id: propertyId,
          name,
          description,
          pattern_type: patternType,
          room_type_id: roomTypeId || null,
          room_id: roomId || null,
          days_of_week: daysOfWeek || null,
          min_nights: minNights || null,
          max_nights: maxNights || null,
          occupancy: occupancy || null,
          price_modifier: priceModifier || null,
          start_date: startDate || null,
          end_date: endDate || null,
          applied_at_level: appliedAtLevel || 'property',
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating recurring pattern:', error);
    return NextResponse.json(
      { error: 'Failed to create recurring pattern' },
      { status: 500 }
    );
  }
}

// PUT: Update a recurring pattern
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patternId,
      name,
      description,
      daysOfWeek,
      minNights,
      maxNights,
      occupancy,
      priceModifier,
      status,
    } = body;

    if (!patternId) {
      return NextResponse.json(
        { error: 'patternId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (daysOfWeek !== undefined) updateData.days_of_week = daysOfWeek;
    if (minNights !== undefined) updateData.min_nights = minNights;
    if (maxNights !== undefined) updateData.max_nights = maxNights;
    if (occupancy !== undefined) updateData.occupancy = occupancy;
    if (priceModifier !== undefined) updateData.price_modifier = priceModifier;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from('recurring_patterns')
      .update(updateData)
      .eq('id', patternId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating recurring pattern:', error);
    return NextResponse.json(
      { error: 'Failed to update recurring pattern' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a recurring pattern
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternIds } = body;

    if (!patternIds || !Array.isArray(patternIds) || patternIds.length === 0) {
      return NextResponse.json(
        { error: 'patternIds array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('recurring_patterns')
      .delete()
      .in('id', patternIds);

    if (error) throw error;

    return NextResponse.json({ message: 'Recurring patterns deleted successfully' });
  } catch (error) {
    console.error('Error deleting recurring patterns:', error);
    return NextResponse.json(
      { error: 'Failed to delete recurring patterns' },
      { status: 500 }
    );
  }
}
