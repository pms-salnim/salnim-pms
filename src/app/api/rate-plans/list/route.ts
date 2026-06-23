import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function isSchemaOrRelationError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('relationship') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

function isMissingTableError(error: any, table: string): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes(`relation \"public.${table.toLowerCase()}\" does not exist`) ||
    message.includes(`relation \"${table.toLowerCase()}\" does not exist`) ||
    message.includes(`could not find the table 'public.${table.toLowerCase()}'`)
  );
}

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
    let { data: ratePlans, error: fetchError } = await supabaseAdmin
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
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (fetchError && isSchemaOrRelationError(fetchError)) {
      const fallback = await supabaseAdmin
        .from('rate_plans')
        .select('*')
        .eq('property_id', propertyId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      ratePlans = fallback.data;
      fetchError = fallback.error;
    }

    console.log('API: Fetched rate plans from DB:', ratePlans);
    console.log('API: Fetch error:', fetchError);

    if (fetchError) {
      if (isMissingTableError(fetchError, 'rate_plans')) {
        return NextResponse.json({ ratePlans: [] });
      }

      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        {
          error: fetchError.message || 'Failed to fetch rate plans',
          details: fetchError,
        },
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

      const transformed = {
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
      console.log('API: Transformed plan:', transformed);
      return transformed;
    });

    console.log('API: Returning transformed plans:', transformedRatePlans);

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
