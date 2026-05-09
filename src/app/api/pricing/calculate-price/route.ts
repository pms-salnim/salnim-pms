import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  calculatePrice,
  getBaseRateForDate,
  calculatePricesForDateRange,
  getPriceBreakdown,
  type BaseRate,
  type RatePlanRule,
} from '@/lib/pricing/priceCalculator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/pricing/calculate-price
 * 
 * Calculates the price for a specific rate plan on a specific date
 * 
 * Query params:
 * - propertyId (required)
 * - ratePlanId (required)
 * - date (required): YYYY-MM-DD format
 * 
 * Returns: { price, breakdown, hasOverride }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const ratePlanId = searchParams.get('ratePlanId');
    const date = searchParams.get('date');

    if (!propertyId || !ratePlanId || !date) {
      return NextResponse.json(
        { error: 'Missing required params: propertyId, ratePlanId, date' },
        { status: 400 }
      );
    }

    // ✅ STEP 1: Get rate plan with adjustment rules
    const { data: ratePlanData, error: planError } = await supabase
      .from('rate_plans')
      .select('id, name, room_type_id, adjustment_type, adjustment_value, is_derived_from_base, nightly_rate')
      .eq('id', ratePlanId)
      .eq('property_id', propertyId)
      .single();

    if (planError || !ratePlanData) {
      return NextResponse.json(
        { error: 'Rate plan not found' },
        { status: 404 }
      );
    }

    const ratePlan: RatePlanRule = {
      id: ratePlanData.id,
      name: ratePlanData.name,
      adjustment_type: ratePlanData.adjustment_type || 'none',
      adjustment_value: ratePlanData.adjustment_value || 0,
      is_derived_from_base: ratePlanData.is_derived_from_base !== false,
      nightly_rate: ratePlanData.nightly_rate,
    };

    // ✅ STEP 2: Get base rate for the date
    const { data: baseRateData, error: baseError } = await supabase
      .from('base_rates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('room_type_id', ratePlanData.room_type_id)
      .eq('is_active', true);

    if (baseError) {
      return NextResponse.json(
        { error: 'Failed to fetch base rates' },
        { status: 500 }
      );
    }

    const baseRate = getBaseRateForDate(date, baseRateData as BaseRate[] || []);

    // ✅ STEP 3: Get override if exists
    const { data: override, error: overrideError } = await supabase
      .from('rate_plan_overrides')
      .select('*')
      .eq('rate_plan_id', ratePlanId)
      .eq('date_date', date)
      .single();

    if (overrideError && overrideError.code !== 'PGRST116') {
      console.error('[Calculate Price API] Override fetch error:', overrideError);
    }

    // ✅ STEP 4: Calculate price
    const finalPrice = calculatePrice(
      date,
      baseRate,
      ratePlan,
      override || undefined
    );

    const breakdown = getPriceBreakdown(
      date,
      baseRate,
      ratePlan,
      override || undefined
    );

    console.log('[Calculate Price API] Calculated:', {
      ratePlan: ratePlan.name,
      date,
      price: finalPrice,
      hasOverride: !!override,
    });

    return NextResponse.json({
      success: true,
      data: {
        price: finalPrice,
        breakdown: breakdown.breakdown,
        hasOverride: !!override,
        baseRate: baseRate?.base_price || null,
        adjustment: {
          type: ratePlan.adjustment_type,
          value: ratePlan.adjustment_value,
        },
      },
    });
  } catch (error) {
    console.error('[Calculate Price API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to calculate price', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pricing/calculate-price
 * 
 * Calculates prices for a date range for a specific rate plan
 * 
 * Body:
 * {
 *   propertyId,
 *   ratePlanId,
 *   startDate: YYYY-MM-DD,
 *   endDate: YYYY-MM-DD
 * }
 * 
 * Returns: Array of { date, price, baseRate, adjustment, isOverride }
 */
export async function POST(request: NextRequest) {
  try {
    const { propertyId, ratePlanId, startDate, endDate } = await request.json();

    if (!propertyId || !ratePlanId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, ratePlanId, startDate, endDate' },
        { status: 400 }
      );
    }

    // ✅ STEP 1: Get rate plan
    const { data: ratePlanData, error: planError } = await supabase
      .from('rate_plans')
      .select('id, name, room_type_id, adjustment_type, adjustment_value, is_derived_from_base, nightly_rate')
      .eq('id', ratePlanId)
      .eq('property_id', propertyId)
      .single();

    if (planError || !ratePlanData) {
      return NextResponse.json(
        { error: 'Rate plan not found' },
        { status: 404 }
      );
    }

    const ratePlan: RatePlanRule = {
      id: ratePlanData.id,
      name: ratePlanData.name,
      adjustment_type: ratePlanData.adjustment_type || 'none',
      adjustment_value: ratePlanData.adjustment_value || 0,
      is_derived_from_base: ratePlanData.is_derived_from_base !== false,
      nightly_rate: ratePlanData.nightly_rate,
    };

    // ✅ STEP 2: Get base rates
    const { data: baseRateData, error: baseError } = await supabase
      .from('base_rates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('room_type_id', ratePlanData.room_type_id)
      .eq('is_active', true);

    if (baseError) {
      return NextResponse.json(
        { error: 'Failed to fetch base rates' },
        { status: 500 }
      );
    }

    // ✅ STEP 3: Get overrides for date range
    const { data: overridesData, error: overridesError } = await supabase
      .from('rate_plan_overrides')
      .select('*')
      .eq('rate_plan_id', ratePlanId)
      .gte('date_date', startDate)
      .lte('date_date', endDate);

    if (overridesError) {
      console.error('[Calculate Price Range API] Overrides fetch error:', overridesError);
    }

    // ✅ STEP 4: Calculate prices for range
    const prices = calculatePricesForDateRange(
      startDate,
      endDate,
      ratePlan,
      baseRateData as BaseRate[] || [],
      overridesData || []
    );

    console.log('[Calculate Price Range API] Calculated:', {
      ratePlan: ratePlan.name,
      dateRange: `${startDate} to ${endDate}`,
      totalDays: prices.length,
      overrideCount: overridesData?.length || 0,
    });

    // Calculate summary stats
    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const minPrice = Math.min(...prices.map(p => p.price));
    const maxPrice = Math.max(...prices.map(p => p.price));
    const totalRevenue = prices.reduce((sum, p) => sum + p.price, 0);

    return NextResponse.json({
      success: true,
      data: {
        prices,
        summary: {
          totalDays: prices.length,
          avgPrice: Math.round(avgPrice * 100) / 100,
          minPrice,
          maxPrice,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          overrideCount: overridesData?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error('[Calculate Price Range API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to calculate prices', details: errorMessage },
      { status: 500 }
    );
  }
}
