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
    const { action, propertyId, promotion, promotionId } = body;

    console.log('Promotions CRUD request:', { action, propertyId, promotionId, userId: user.id });

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
      if (!promotion) {
        return NextResponse.json(
          { error: 'promotion is required for create action' },
          { status: 400 }
        );
      }

      try {
        // Parse dates safely
        let startDateStr = null;
        let endDateStr = null;
        
        if (promotion.startDate) {
          const startDate = new Date(promotion.startDate);
          if (!isNaN(startDate.getTime())) {
            startDateStr = startDate.toISOString().split('T')[0];
          }
        }
        
        if (promotion.endDate) {
          const endDate = new Date(promotion.endDate);
          if (!isNaN(endDate.getTime())) {
            endDateStr = endDate.toISOString().split('T')[0];
          }
        }

        // Parse discount value safely
        let discountValue = 0;
        if (promotion.discountValue !== undefined && promotion.discountValue !== null) {
          discountValue = parseFloat(promotion.discountValue);
          if (isNaN(discountValue)) {
            discountValue = 0;
          }
        }

        // Create the promotion
        const { data: createdPromo, error: createError } = await supabaseAdmin
          .from('promotions')
          .insert({
            id: promotion.id,
            property_id: propertyId,
            name: promotion.name,
            code: promotion.couponCode || promotion.name,
            description: promotion.description || null,
            promotion_type: promotion.promotionType || 'automatic',
            discount_type: promotion.discountType === 'flat_rate' ? 'fixed' : 'percentage',
            discount_value: discountValue,
            rate_plan_ids: promotion.ratePlanIds || [],
            max_uses: promotion.usageLimit || null,
            current_uses: 0,
            start_date: startDateStr,
            end_date: endDateStr,
            is_active: promotion.active || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();

        if (createError) {
          console.error('Create error:', createError);
          return NextResponse.json(
            { error: createError.message || 'Failed to create promotion' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Promotion created successfully',
          data: createdPromo,
        });
      } catch (err: any) {
        console.error('Create exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to create promotion' },
          { status: 500 }
        );
      }
    }

    // HANDLE UPDATE ACTION
    if (action === 'update') {
      if (!promotionId || !promotion) {
        return NextResponse.json(
          { error: 'promotionId and promotion are required for update action' },
          { status: 400 }
        );
      }

      try {
        // Parse dates safely
        let startDateStr = null;
        let endDateStr = null;
        
        if (promotion.startDate) {
          const startDate = new Date(promotion.startDate);
          if (!isNaN(startDate.getTime())) {
            startDateStr = startDate.toISOString().split('T')[0];
          }
        }
        
        if (promotion.endDate) {
          const endDate = new Date(promotion.endDate);
          if (!isNaN(endDate.getTime())) {
            endDateStr = endDate.toISOString().split('T')[0];
          }
        }

        // Parse discount value safely
        let discountValue = 0;
        if (promotion.discountValue !== undefined && promotion.discountValue !== null) {
          discountValue = parseFloat(promotion.discountValue);
          if (isNaN(discountValue)) {
            discountValue = 0;
          }
        }

        // Update the promotion
        const { data: updatedPromo, error: updateError } = await supabaseAdmin
          .from('promotions')
          .update({
            name: promotion.name,
            code: promotion.couponCode || promotion.name,
            description: promotion.description || null,
            promotion_type: promotion.promotionType || 'automatic',
            discount_type: promotion.discountType === 'flat_rate' ? 'fixed' : 'percentage',
            discount_value: discountValue,
            rate_plan_ids: promotion.ratePlanIds || [],
            max_uses: promotion.usageLimit || null,
            start_date: startDateStr,
            end_date: endDateStr,
            is_active: promotion.active || false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', promotionId)
          .eq('property_id', propertyId)
          .select();

        if (updateError) {
          console.error('Update error:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to update promotion' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Promotion updated successfully',
          data: updatedPromo,
        });
      } catch (err: any) {
        console.error('Update exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to update promotion' },
          { status: 500 }
        );
      }
    }

    // HANDLE DELETE ACTION
    if (action === 'delete') {
      if (!promotionId) {
        return NextResponse.json(
          { error: 'promotionId is required for delete action' },
          { status: 400 }
        );
      }

      try {
        const { error: deleteError } = await supabaseAdmin
          .from('promotions')
          .delete()
          .eq('id', promotionId)
          .eq('property_id', propertyId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return NextResponse.json(
            { error: deleteError.message || 'Failed to delete promotion' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Promotion deleted successfully',
        });
      } catch (err: any) {
        console.error('Delete exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to delete promotion' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
