import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/pricing/rate-plan-adjustments
 * 
 * Manages how rate plans adjust the base rate:
 * - update: Set adjustment type and value for a rate plan
 * - get: Get adjustment rules for a rate plan
 * 
 * Adjustment Types:
 * - 'none': Use base rate as-is
 * - 'fixed': Add a fixed amount (e.g., +50)
 * - 'percentage': Add a percentage (e.g., +20%)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, propertyId, ratePlanId, adjustment } = body;

    console.log('[Rate Plan Adjustments API] Request:', { action, ratePlanId });

    // ✅ UPDATE rate plan adjustment
    if (action === 'update') {
      if (!ratePlanId || !adjustment) {
        return NextResponse.json(
          { error: 'Missing required fields: ratePlanId, adjustment' },
          { status: 400 }
        );
      }

      const { adjustment_type, adjustment_value, is_derived_from_base } = adjustment;

      if (!adjustment_type || adjustment_type === '') {
        return NextResponse.json(
          { error: 'Missing required field: adjustment_type (none|fixed|percentage)' },
          { status: 400 }
        );
      }

      if (!['none', 'fixed', 'percentage'].includes(adjustment_type)) {
        return NextResponse.json(
          { error: 'Invalid adjustment_type. Must be: none, fixed, or percentage' },
          { status: 400 }
        );
      }

      if (adjustment_value === undefined || adjustment_value === null) {
        return NextResponse.json(
          { error: 'Missing required field: adjustment_value' },
          { status: 400 }
        );
      }

      const updateData: any = {
        adjustment_type,
        adjustment_value: parseFloat(adjustment_value),
        is_derived_from_base: is_derived_from_base !== false, // Default to true
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('rate_plans')
        .update(updateData)
        .eq('id', ratePlanId)
        .select();

      if (error) {
        console.error('[Rate Plan Adjustments API] Update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Adjustments API] Updated rate plan adjustment:', ratePlanId, updateData);

      return NextResponse.json({
        success: true,
        message: `Rate plan adjustment updated: ${adjustment_type} ${adjustment_value}`,
        data: data?.[0],
      });
    }

    // ✅ GET rate plan adjustment
    if (action === 'get') {
      if (!ratePlanId) {
        return NextResponse.json(
          { error: 'Missing required field: ratePlanId' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('rate_plans')
        .select('id, name, adjustment_type, adjustment_value, is_derived_from_base, nightly_rate')
        .eq('id', ratePlanId)
        .single();

      if (error) {
        console.error('[Rate Plan Adjustments API] Get error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Adjustments API] Retrieved rate plan adjustment:', ratePlanId);

      return NextResponse.json({
        success: true,
        data,
      });
    }

    // ✅ LIST all rate plans for a room type with their adjustments
    if (action === 'list') {
      if (!propertyId) {
        return NextResponse.json(
          { error: 'Missing required field: propertyId' },
          { status: 400 }
        );
      }

      const roomTypeId = adjustment?.room_type_id; // optional filter

      let query = supabase
        .from('rate_plans')
        .select('id, name, room_type_id, adjustment_type, adjustment_value, is_derived_from_base, nightly_rate')
        .eq('property_id', propertyId);

      if (roomTypeId) {
        query = query.eq('room_type_id', roomTypeId);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        console.error('[Rate Plan Adjustments API] List error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Rate Plan Adjustments API] Listed rate plans:', data?.length);

      return NextResponse.json({
        success: true,
        data,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Rate Plan Adjustments API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
