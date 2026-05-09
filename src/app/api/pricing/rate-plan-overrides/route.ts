import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/pricing/rate-plan-overrides
 * 
 * Manages price overrides for specific dates/rate plans:
 * - create: Set a specific price for a date that overrides calculated price
 * - read: Get overrides for a rate plan
 * - delete: Remove an override
 * 
 * Override flow:
 * 1. Check if override exists for date → use it
 * 2. Otherwise → calculate from base + adjustment
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, propertyId, override, overrideId } = body;

    console.log('[Rate Plan Overrides API] Request:', { action, overrideId });

    // ✅ CREATE override
    if (action === 'create') {
      if (!override || !propertyId) {
        return NextResponse.json(
          { error: 'Missing required fields: override, propertyId' },
          { status: 400 }
        );
      }

      const { rate_plan_id, date, override_price, reason } = override;

      if (!rate_plan_id || !date || override_price === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields in override: rate_plan_id, date, override_price' },
          { status: 400 }
        );
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      const newId = `override_${rate_plan_id}_${date}_${Date.now()}`;

      const { data, error } = await supabase
        .from('rate_plan_overrides')
        .insert([
          {
            id: newId,
            property_id: propertyId,
            rate_plan_id,
            date_date: date,
            override_price: parseFloat(override_price),
            reason: reason || null,
          },
        ])
        .select();

      if (error) {
        console.error('[Rate Plan Overrides API] Create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Overrides API] Created override:', newId);

      return NextResponse.json(
        {
          success: true,
          message: `Override created for ${date}: €${override_price}`,
          data: data?.[0],
        },
        { status: 201 }
      );
    }

    // ✅ READ overrides for a rate plan
    if (action === 'read') {
      if (!override?.rate_plan_id) {
        return NextResponse.json(
          { error: 'Missing required field: rate_plan_id' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('rate_plan_overrides')
        .select('*')
        .eq('rate_plan_id', override.rate_plan_id)
        .order('date_date', { ascending: true });

      if (error) {
        console.error('[Rate Plan Overrides API] Read error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Overrides API] Retrieved overrides:', data?.length);

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // ✅ GET override for specific date
    if (action === 'get-by-date') {
      if (!override?.rate_plan_id || !override?.date) {
        return NextResponse.json(
          { error: 'Missing required fields: rate_plan_id, date' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('rate_plan_overrides')
        .select('*')
        .eq('rate_plan_id', override.rate_plan_id)
        .eq('date_date', override.date)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (which is fine)
        console.error('[Rate Plan Overrides API] Get error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Overrides API] Retrieved override for', override.date);

      return NextResponse.json({
        success: true,
        data: data || null,
      });
    }

    // ✅ DELETE override
    if (action === 'delete') {
      if (!overrideId) {
        return NextResponse.json(
          { error: 'Missing required field: overrideId' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('rate_plan_overrides')
        .delete()
        .eq('id', overrideId);

      if (error) {
        console.error('[Rate Plan Overrides API] Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Overrides API] Deleted override:', overrideId);

      return NextResponse.json({
        success: true,
        message: 'Override deleted',
      });
    }

    // ✅ BULK DELETE overrides for a date range
    if (action === 'delete-range') {
      if (!override?.rate_plan_id || !override?.start_date || !override?.end_date) {
        return NextResponse.json(
          { error: 'Missing required fields: rate_plan_id, start_date, end_date' },
          { status: 400 }
        );
      }

      const { error, count } = await supabase
        .from('rate_plan_overrides')
        .delete()
        .eq('rate_plan_id', override.rate_plan_id)
        .gte('date_date', override.start_date)
        .lte('date_date', override.end_date);

      if (error) {
        console.error('[Rate Plan Overrides API] Delete range error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Overrides API] Deleted overrides:', count);

      return NextResponse.json({
        success: true,
        message: `${count} overrides deleted`,
        count,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Rate Plan Overrides API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
