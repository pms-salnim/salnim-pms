/**
 * API Route: /api/services/crud
 * Handle Create, Read, Update, Delete operations for services
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Verify token
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, propertyId, service, serviceId } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this property
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('property_id')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData || userData.property_id !== propertyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // HANDLE CREATE ACTION
    if (action === 'create') {
      if (!service) {
        return NextResponse.json(
          { error: 'Service data is required' },
          { status: 400 }
        );
      }

      try {
        const newService = {
          id: uuidv4(),
          property_id: propertyId,
          name: service.name,
          description: service.description || null,
          price: service.price || 0,
          category: service.category || null,
          category_id: service.categoryId || null,
          subcategory_id: service.subcategoryId || null,
          per_night: service.perNight || false,
          booking_engine: service.bookingEngine !== undefined ? service.bookingEngine : false,
          guest_portal: service.guestPortal !== undefined ? service.guestPortal : false,
          staff_only: service.staffOnly !== undefined ? service.staffOnly : false,
          status: service.status || 'Active',
          is_active: service.isActive !== undefined ? service.isActive : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdService, error: createError } = await supabaseAdmin
          .from('services')
          .insert([newService])
          .select();

        if (createError) {
          console.error('Create error:', createError);
          return NextResponse.json(
            { error: createError.message || 'Failed to create service' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Service created successfully',
          data: createdService,
        });
      } catch (err: any) {
        console.error('Create exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to create service' },
          { status: 500 }
        );
      }
    }

    // HANDLE UPDATE ACTION
    if (action === 'update') {
      if (!serviceId || !service) {
        return NextResponse.json(
          { error: 'Service ID and service data are required' },
          { status: 400 }
        );
      }

      try {
        const updatePayload = {
          name: service.name,
          description: service.description || null,
          price: service.price || 0,
          category: service.category || null,
          category_id: service.categoryId || null,
          subcategory_id: service.subcategoryId || null,
          per_night: service.perNight || false,
          booking_engine: service.bookingEngine !== undefined ? service.bookingEngine : false,
          guest_portal: service.guestPortal !== undefined ? service.guestPortal : false,
          staff_only: service.staffOnly !== undefined ? service.staffOnly : false,
          status: service.status || 'Active',
          is_active: service.isActive !== undefined ? service.isActive : true,
          updated_at: new Date().toISOString(),
        };

        const { data: updatedService, error: updateError } = await supabaseAdmin
          .from('services')
          .update(updatePayload)
          .eq('id', serviceId)
          .eq('property_id', propertyId)
          .select();

        if (updateError) {
          console.error('Update error:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to update service' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Service updated successfully',
          data: updatedService,
        });
      } catch (err: any) {
        console.error('Update exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to update service' },
          { status: 500 }
        );
      }
    }

    // HANDLE DELETE ACTION
    if (action === 'delete') {
      if (!serviceId) {
        return NextResponse.json(
          { error: 'Service ID is required' },
          { status: 400 }
        );
      }

      try {
        const { error: deleteError } = await supabaseAdmin
          .from('services')
          .delete()
          .eq('id', serviceId)
          .eq('property_id', propertyId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return NextResponse.json(
            { error: deleteError.message || 'Failed to delete service' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Service deleted successfully',
        });
      } catch (err: any) {
        console.error('Delete exception:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to delete service' },
          { status: 500 }
        );
      }
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
