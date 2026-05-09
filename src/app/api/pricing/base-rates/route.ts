import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyAuth(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ─────────────────────────────────────────────────────────────
// GET /api/pricing/base-rates?propertyId=...
// List all base rates for a property
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'Missing propertyId query param' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('base_rates')
      .select('*')
      .eq('property_id', propertyId)
      .order('room_type_id', { ascending: true })
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[Base Rates API] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Base Rates API] GET list:', data?.length);
    return NextResponse.json({ success: true, baseRates: data ?? [] });
  } catch (err) {
    console.error('[Base Rates API] GET exception:', err);
    return NextResponse.json({ error: 'Failed to list base rates' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/pricing/base-rates  →  create new base rate
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, baseRate } = body;

    console.log('[Base Rates API] POST create:', { propertyId, roomType: baseRate?.room_type_id });

    if (!baseRate || !propertyId) {
      return NextResponse.json(
        { error: 'Missing required fields: baseRate, propertyId' },
        { status: 400 }
      );
    }

    const { room_type_id, base_price, start_date, end_date } = baseRate;

    if (!room_type_id || !start_date) {
      return NextResponse.json(
        { error: 'Missing required fields in baseRate: room_type_id, start_date' },
        { status: 400 }
      );
    }

    const newId = baseRate.id || `base_rate_${propertyId}_${room_type_id}_${Date.now()}`;

    const { data, error } = await supabase
      .from('base_rates')
      .insert([{
        id: newId,
        property_id: propertyId,
        room_type_id,
        base_price: parseFloat(base_price) || 0,
        day_prices: baseRate.day_prices ?? {},
        applied_days: baseRate.applied_days ?? ['MON','TUE','WED','THU','FRI','SAT','SUN'],
        start_date,
        end_date: end_date || null,
        extra_adult_price: baseRate.extra_adult_price || null,
        extra_adult_price_type: baseRate.extra_adult_price_type || 'fixed',
        extra_child_price: baseRate.extra_child_price || null,
        extra_child_price_type: baseRate.extra_child_price_type || 'fixed',
        single_use_discount: baseRate.single_use_discount || null,
        single_use_discount_type: baseRate.single_use_discount_type || 'percentage',
        min_los: baseRate.min_los || null,
        max_los: baseRate.max_los || null,
        closed_to_arrival: baseRate.closed_to_arrival || false,
        closed_to_departure: baseRate.closed_to_departure || false,
        is_active: baseRate.is_active ?? true,
      }])
      .select();

    if (error) {
      console.error('[Base Rates API] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Base Rates API] Created:', data?.[0]?.id);
    return NextResponse.json({ success: true, data: data?.[0] }, { status: 201 });
  } catch (err) {
    console.error('[Base Rates API] POST exception:', err);
    return NextResponse.json({ error: 'Failed to create base rate' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/pricing/base-rates  →  update existing base rate
// ─────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseRateId, baseRate } = body;

    console.log('[Base Rates API] PATCH update:', { baseRateId });

    if (!baseRateId || !baseRate) {
      return NextResponse.json({ error: 'Missing baseRateId or baseRate' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (baseRate.base_price      !== undefined) updateData.base_price      = parseFloat(baseRate.base_price);
    if (baseRate.day_prices      !== undefined) updateData.day_prices      = baseRate.day_prices;
    if (baseRate.applied_days    !== undefined) updateData.applied_days    = baseRate.applied_days;
    if (baseRate.start_date      !== undefined) updateData.start_date      = baseRate.start_date;
    if (baseRate.end_date        !== undefined) updateData.end_date        = baseRate.end_date;
    if (baseRate.is_active       !== undefined) updateData.is_active       = baseRate.is_active;
    if (baseRate.extra_adult_price !== undefined)      updateData.extra_adult_price      = baseRate.extra_adult_price;
    if (baseRate.extra_adult_price_type !== undefined) updateData.extra_adult_price_type = baseRate.extra_adult_price_type;
    if (baseRate.extra_child_price !== undefined)      updateData.extra_child_price      = baseRate.extra_child_price;
    if (baseRate.extra_child_price_type !== undefined) updateData.extra_child_price_type = baseRate.extra_child_price_type;
    if (baseRate.single_use_discount !== undefined)      updateData.single_use_discount      = baseRate.single_use_discount;
    if (baseRate.single_use_discount_type !== undefined) updateData.single_use_discount_type = baseRate.single_use_discount_type;
    if (baseRate.min_los           !== undefined) updateData.min_los           = baseRate.min_los;
    if (baseRate.max_los           !== undefined) updateData.max_los           = baseRate.max_los;
    if (baseRate.closed_to_arrival !== undefined) updateData.closed_to_arrival = baseRate.closed_to_arrival;
    if (baseRate.closed_to_departure !== undefined) updateData.closed_to_departure = baseRate.closed_to_departure;

    const { data, error } = await supabase
      .from('base_rates')
      .update(updateData)
      .eq('id', baseRateId)
      .select();

    if (error) {
      console.error('[Base Rates API] PATCH update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Base Rates API] Updated:', baseRateId);
    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err) {
    console.error('[Base Rates API] PATCH exception:', err);
    return NextResponse.json({ error: 'Failed to update base rate' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/pricing/base-rates  →  delete a base rate
// ─────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseRateId, propertyId } = body;

    console.log('[Base Rates API] DELETE:', { baseRateId, propertyId });

    if (!baseRateId) {
      return NextResponse.json({ error: 'Missing baseRateId' }, { status: 400 });
    }

    const query = supabase.from('base_rates').delete().eq('id', baseRateId);
    if (propertyId) query.eq('property_id', propertyId); // extra safety guard

    const { error } = await query;

    if (error) {
      console.error('[Base Rates API] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Base Rates API] Deleted:', baseRateId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Base Rates API] DELETE exception:', err);
    return NextResponse.json({ error: 'Failed to delete base rate' }, { status: 500 });
  }
}
