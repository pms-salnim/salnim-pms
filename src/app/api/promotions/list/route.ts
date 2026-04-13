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

    // Fetch promotions
    const { data: promotions, error: fetchError } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch promotions' },
        { status: 500 }
      );
    }

    // Transform promotions from snake_case to camelCase
    const transformedPromotions = (promotions || []).map((promo: any) => ({
      id: promo.id,
      propertyId: promo.property_id,
      name: promo.name,
      couponCode: promo.code,
      description: promo.description,
      promotionType: promo.promotion_type || 'automatic',
      discountType: promo.discount_type === 'fixed' ? 'flat_rate' : 'percentage',
      discountValue: promo.discount_value,
      ratePlanIds: promo.rate_plan_ids || [],
      usageLimit: promo.max_uses,
      timesUsed: promo.current_uses || 0,
      startDate: promo.start_date ? new Date(promo.start_date) : null,
      endDate: promo.end_date ? new Date(promo.end_date) : null,
      active: promo.is_active,
      createdAt: promo.created_at ? new Date(promo.created_at) : null,
      updatedAt: promo.updated_at ? new Date(promo.updated_at) : null,
    }));

    return NextResponse.json({
      promotions: transformedPromotions || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
