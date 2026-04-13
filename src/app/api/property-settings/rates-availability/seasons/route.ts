import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET seasons for a property
// POST create a new season
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('seasons')
      .select('*')
      .eq('property_id', propertyId)
      .order('season_start', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    );
  }
}

// POST: Create a new season
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      seasonStart,
      seasonEnd,
      priceModifier,
      color,
    } = body;

    if (!propertyId || !name || !seasonStart || !seasonEnd || priceModifier === undefined) {
      return NextResponse.json(
        { error: 'propertyId, name, seasonStart, seasonEnd, and priceModifier are required' },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(seasonStart) > new Date(seasonEnd)) {
      return NextResponse.json(
        { error: 'Season start date must be before end date' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Generate ID
    const id = Buffer.from(`${propertyId}|${name}|${Date.now()}`).toString('base64').substring(0, 50);

    const { data, error } = await supabase
      .from('seasons')
      .insert([
        {
          id,
          property_id: propertyId,
          name,
          description,
          season_start: seasonStart,
          season_end: seasonEnd,
          price_modifier: priceModifier,
          color: color || null,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json(
      { error: 'Failed to create season' },
      { status: 500 }
    );
  }
}

// PUT: Update a season
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      seasonId,
      name,
      description,
      seasonStart,
      seasonEnd,
      priceModifier,
      color,
      status,
    } = body;

    if (!seasonId) {
      return NextResponse.json(
        { error: 'seasonId is required' },
        { status: 400 }
      );
    }

    // Validate date range if both dates provided
    if (seasonStart && seasonEnd && new Date(seasonStart) > new Date(seasonEnd)) {
      return NextResponse.json(
        { error: 'Season start date must be before end date' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (seasonStart !== undefined) updateData.season_start = seasonStart;
    if (seasonEnd !== undefined) updateData.season_end = seasonEnd;
    if (priceModifier !== undefined) updateData.price_modifier = priceModifier;
    if (color !== undefined) updateData.color = color;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from('seasons')
      .update(updateData)
      .eq('id', seasonId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating season:', error);
    return NextResponse.json(
      { error: 'Failed to update season' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a season
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { seasonIds } = body;

    if (!seasonIds || !Array.isArray(seasonIds) || seasonIds.length === 0) {
      return NextResponse.json(
        { error: 'seasonIds array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('seasons')
      .delete()
      .in('id', seasonIds);

    if (error) throw error;

    return NextResponse.json({ message: 'Seasons deleted successfully' });
  } catch (error) {
    console.error('Error deleting seasons:', error);
    return NextResponse.json(
      { error: 'Failed to delete seasons' },
      { status: 500 }
    );
  }
}
