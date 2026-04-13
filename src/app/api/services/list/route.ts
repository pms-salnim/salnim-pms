/**
 * API Route: /api/services/list
 * Fetch all services for a property from Supabase
 */

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

    // Get property ID from query
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

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
        { error: 'Unauthorized - property does not belong to user' },
        { status: 403 }
      );
    }

    // Fetch services for the property with category details
    const { data: services, error: fetchError } = await supabaseAdmin
      .from('services')
      .select(`
        *,
        category_ref:category_id(id, name),
        subcategory_ref:subcategory_id(id, name)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch services' },
        { status: 500 }
      );
    }

    // Transform services from snake_case to camelCase with category hierarchy
    const transformedServices = (services || []).map((service: any) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      category: service.category,
      categoryId: service.category_id,
      categoryName: service.category_ref?.name || null,
      subcategoryId: service.subcategory_id,
      subcategoryName: service.subcategory_ref?.name || null,
      perNight: service.per_night,
      bookingEngine: service.booking_engine || false,
      guestPortal: service.guest_portal || false,
      staffOnly: service.staff_only || false,
      status: service.status || (service.is_active ? 'Active' : 'Draft'),
      isActive: service.is_active,
      createdAt: new Date(service.created_at),
      updatedAt: new Date(service.updated_at),
    }));

    return NextResponse.json({
      services: transformedServices || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
