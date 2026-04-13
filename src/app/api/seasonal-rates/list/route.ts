import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify the token and get the user
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get propertyId from query params
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Verify user owns this property
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('owner_id', user.id)
      .single();

    if (propError || !property) {
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 403 }
      );
    }

    // Fetch seasonal rates with joined rate_plan and room_type data
    const { data: seasonalRates, error: fetchError } = await supabaseAdmin
      .from('seasonal_rates')
      .select(`
        *,
        rate_plans (
          id,
          plan_name,
          room_type_id,
          room_types (
            id,
            name,
            max_guests
          )
        )
      `)
      .eq('property_id', propertyId)
      .order('start_date', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch seasonal rates' },
        { status: 500 }
      );
    }

    // Transform seasonal rates from snake_case to camelCase
    const transformedSeasonalRates = (seasonalRates || []).map((rate: any) => {
      let ratePlan: any = null;
      if (rate.rate_plans) {
        const rp = rate.rate_plans;
        ratePlan = {
          id: rp.id,
          planName: rp.plan_name,
          roomTypeId: rp.room_type_id,
          roomType: rp.room_types ? {
            id: rp.room_types.id,
            name: rp.room_types.name,
            maxGuests: rp.room_types.max_guests,
          } : null,
        };
      }

      return {
        id: rate.id,
        propertyId: rate.property_id,
        name: rate.name,
        ratePlanId: rate.rate_plan_id,
        startDate: new Date(rate.start_date),
        endDate: new Date(rate.end_date),
        basePrice: rate.base_price,
        pricingPerGuest: rate.pricing_per_guest || {},
        active: rate.is_active,
        createdBy: rate.created_by,
        createdAt: new Date(rate.created_at),
        updatedAt: rate.updated_at ? new Date(rate.updated_at) : null,
        rate_plans: ratePlan,
      };
    });

    return NextResponse.json({
      seasonalRates: transformedSeasonalRates || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
