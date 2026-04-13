import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
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

    // Verify user owns this property by checking users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('property_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Unauthorized - property does not belong to user' },
        { status: 403 }
      );
    }

    // Fetch rate plans with joined room type data
    const { data: ratePlans, error: fetchError } = await supabaseAdmin
      .from('rate_plans')
      .select(`
        *,
        room_types (
          id,
          name,
          max_guests
        )
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch rate plans' },
        { status: 500 }
      );
    }

    // Transform rate plans from snake_case to camelCase
    const transformedRatePlans = (ratePlans || []).map((plan: any) => {
      let roomType: any = null;
      if (plan.room_types) {
        roomType = {
          id: plan.room_types.id,
          name: plan.room_types.name,
          maxGuests: plan.room_types.max_guests,
        };
      }

      return {
        id: plan.id,
        planName: plan.plan_name,
        description: plan.description,
        propertyId: plan.property_id,
        roomTypeId: plan.room_type_id,
        pricingMethod: plan.pricing_method || 'per_guest',
        basePrice: plan.base_price,
        pricingPerGuest: plan.pricing_per_guest || {},
        cancellationPolicy: plan.cancellation_policy,
        default: plan.is_default,
        startDate: plan.start_date ? new Date(plan.start_date) : null,
        endDate: plan.end_date ? new Date(plan.end_date) : null,
        createdBy: plan.created_by,
        createdAt: new Date(plan.created_at),
        updatedAt: plan.updated_at ? new Date(plan.updated_at) : null,
        room_types: roomType,
      };
    });

    return NextResponse.json({
      ratePlans: transformedRatePlans || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
