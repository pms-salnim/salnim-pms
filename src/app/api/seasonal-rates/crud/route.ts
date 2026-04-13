import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action, propertyId, seasonalRate, seasonalRateId } = body;

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

    // HANDLE CREATE ACTION
    if (action === 'create') {
      if (!seasonalRate) {
        return NextResponse.json(
          { error: 'seasonalRate is required for create action' },
          { status: 400 }
        );
      }

      // Create the seasonal rate
      const { data: createdRate, error: createError } = await supabaseAdmin
        .from('seasonal_rates')
        .insert({
          id: seasonalRate.id,
          property_id: propertyId,
          name: seasonalRate.name,
          rate_plan_id: seasonalRate.ratePlanId,
          start_date: new Date(seasonalRate.startDate).toISOString().split('T')[0],
          end_date: new Date(seasonalRate.endDate).toISOString().split('T')[0],
          base_price: seasonalRate.basePrice || null,
          pricing_per_guest: seasonalRate.pricingPerGuest || {},
          is_active: seasonalRate.active !== undefined ? seasonalRate.active : true,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();

      if (createError) {
        console.error('Create error:', createError);
        return NextResponse.json(
          { error: createError.message || 'Failed to create seasonal rate' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Seasonal rate created successfully',
        data: createdRate,
      });
    }

    // HANDLE UPDATE ACTION
    if (action === 'update') {
      if (!seasonalRateId || !seasonalRate) {
        return NextResponse.json(
          { error: 'seasonalRateId and seasonalRate are required for update action' },
          { status: 400 }
        );
      }

      // Update the seasonal rate
      const { data: updatedRate, error: updateError } = await supabaseAdmin
        .from('seasonal_rates')
        .update({
          name: seasonalRate.name,
          rate_plan_id: seasonalRate.ratePlanId,
          start_date: new Date(seasonalRate.startDate).toISOString().split('T')[0],
          end_date: new Date(seasonalRate.endDate).toISOString().split('T')[0],
          base_price: seasonalRate.basePrice || null,
          pricing_per_guest: seasonalRate.pricingPerGuest || {},
          is_active: seasonalRate.active !== undefined ? seasonalRate.active : true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', seasonalRateId)
        .eq('property_id', propertyId)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        return NextResponse.json(
          { error: updateError.message || 'Failed to update seasonal rate' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Seasonal rate updated successfully',
        data: updatedRate,
      });
    }

    // HANDLE DELETE ACTION
    if (action === 'delete') {
      if (!seasonalRateId) {
        return NextResponse.json(
          { error: 'seasonalRateId is required for delete action' },
          { status: 400 }
        );
      }

      // Delete the seasonal rate
      const { error: deleteError } = await supabaseAdmin
        .from('seasonal_rates')
        .delete()
        .eq('id', seasonalRateId)
        .eq('property_id', propertyId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message || 'Failed to delete seasonal rate' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Seasonal rate deleted successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
