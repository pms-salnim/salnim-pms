import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action, propertyId, ratePlan, ratePlanId } = body;

    console.log('Rate plans CRUD request:', { action, propertyId, ratePlanId, userId: user.id });

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

    console.log('User verification:', { userId: user.id, userPropertyId: userData?.property_id, propertyId });

    if (userError || !userData || userData.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Unauthorized - property does not belong to user' },
        { status: 403 }
      );
    }

    // HANDLE CREATE ACTION
    if (action === 'create') {
      if (!ratePlan) {
        return NextResponse.json(
          { error: 'ratePlan is required for create action' },
          { status: 400 }
        );
      }

      try {
        // Parse dates safely
        let startDateStr = null;
        let endDateStr = null;
        
        if (ratePlan.startDate) {
          const startDate = new Date(ratePlan.startDate);
          if (!isNaN(startDate.getTime())) {
            startDateStr = startDate.toISOString().split('T')[0];
          }
        }
        
        if (ratePlan.endDate) {
          const endDate = new Date(ratePlan.endDate);
          if (!isNaN(endDate.getTime())) {
            endDateStr = endDate.toISOString().split('T')[0];
          }
        }

        // Parse basePrice safely
        let basePrice = null;
        if (ratePlan.basePrice !== undefined && ratePlan.basePrice !== null) {
          basePrice = parseFloat(ratePlan.basePrice);
          if (isNaN(basePrice)) {
            basePrice = null;
          }
        }

        // If this rate plan is marked as default, unset other defaults for the same room type
        if (ratePlan.default) {
          await supabaseAdmin
            .from('rate_plans')
            .update({ is_default: false })
            .eq('property_id', propertyId)
            .eq('room_type_id', ratePlan.roomTypeId)
            .neq('id', ratePlan.id || '');
        }

        // Create the rate plan
        const { data: createdPlan, error: createError } = await supabaseAdmin
          .from('rate_plans')
          .insert({
            id: ratePlan.id,
            property_id: propertyId,
            plan_name: ratePlan.planName,
            description: ratePlan.description || null,
            room_type_id: ratePlan.roomTypeId,
            pricing_method: ratePlan.pricingMethod || 'per_guest',
            base_price: basePrice,
            base_price_legacy: basePrice || 0, // Populate legacy column for backwards compatibility
            pricing_per_guest: ratePlan.pricingPerGuest || {},
            cancellation_policy: ratePlan.cancellationPolicy || null,
            is_default: ratePlan.default || false,
            start_date: startDateStr,
            end_date: endDateStr,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();

        if (createError) {
          console.error('Create error:', createError);
          return NextResponse.json(
            { error: createError.message || 'Failed to create rate plan' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Rate plan created successfully',
          data: createdPlan,
        });
      } catch (err: any) {
        console.error('Create exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to create rate plan' },
          { status: 500 }
        );
      }
    }

    // HANDLE UPDATE ACTION
    if (action === 'update') {
      if (!ratePlanId || !ratePlan) {
        return NextResponse.json(
          { error: 'ratePlanId and ratePlan are required for update action' },
          { status: 400 }
        );
      }

      try {
        // Parse dates safely
        let startDateStr = null;
        let endDateStr = null;
        
        if (ratePlan.startDate) {
          const startDate = new Date(ratePlan.startDate);
          if (!isNaN(startDate.getTime())) {
            startDateStr = startDate.toISOString().split('T')[0];
          }
        }
        
        if (ratePlan.endDate) {
          const endDate = new Date(ratePlan.endDate);
          if (!isNaN(endDate.getTime())) {
            endDateStr = endDate.toISOString().split('T')[0];
          }
        }

        // Parse basePrice safely
        let basePrice = null;
        if (ratePlan.basePrice !== undefined && ratePlan.basePrice !== null) {
          basePrice = parseFloat(ratePlan.basePrice);
          if (isNaN(basePrice)) {
            basePrice = null;
          }
        }

        // If this rate plan is marked as default, unset other defaults for the same room type
        if (ratePlan.default) {
          await supabaseAdmin
            .from('rate_plans')
            .update({ is_default: false })
            .eq('property_id', propertyId)
            .eq('room_type_id', ratePlan.roomTypeId)
            .neq('id', ratePlanId);
        }

        // Update the rate plan
        const { data: updatedPlan, error: updateError } = await supabaseAdmin
          .from('rate_plans')
          .update({
            plan_name: ratePlan.planName,
            description: ratePlan.description || null,
            room_type_id: ratePlan.roomTypeId,
            pricing_method: ratePlan.pricingMethod || 'per_guest',
            base_price: basePrice,
            base_price_legacy: basePrice || 0, // Update legacy column for backwards compatibility
            pricing_per_guest: ratePlan.pricingPerGuest || {},
            cancellation_policy: ratePlan.cancellationPolicy || null,
            is_default: ratePlan.default || false,
            start_date: startDateStr,
            end_date: endDateStr,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ratePlanId)
          .eq('property_id', propertyId)
          .select();

        if (updateError) {
          console.error('Update error:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to update rate plan' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Rate plan updated successfully',
          data: updatedPlan,
        });
      } catch (err: any) {
        console.error('Update exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to update rate plan' },
          { status: 500 }
        );
      }
    }

    // HANDLE DELETE ACTION
    if (action === 'delete') {
      if (!ratePlanId) {
        return NextResponse.json(
          { error: 'ratePlanId is required for delete action' },
          { status: 400 }
        );
      }

      // Delete the rate plan
      const { error: deleteError } = await supabaseAdmin
        .from('rate_plans')
        .delete()
        .eq('id', ratePlanId)
        .eq('property_id', propertyId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message || 'Failed to delete rate plan' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Rate plan deleted successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Unexpected error in rate-plans/crud:', error);
    const errorMessage = error?.message || error?.toString() || 'Internal server error';
    return NextResponse.json(
      { error: `Server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
