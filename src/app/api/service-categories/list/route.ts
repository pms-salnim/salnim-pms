/**
 * API Route: /api/service-categories/list
 * Fetch all service categories for a property from Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
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

    // Fetch service categories for the property
    const { data: categories, error: fetchError } = await supabaseAdmin
      .from('service_categories')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('parent_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch service categories' },
        { status: 500 }
      );
    }

    // Transform categories from snake_case to camelCase
    const transformedCategories = (categories || []).map((category: any) => ({
      id: category.id,
      name: category.name,
      parentId: category.parent_id,
      description: category.description,
      sortOrder: category.sort_order,
      isActive: category.is_active,
      createdAt: new Date(category.created_at),
      updatedAt: new Date(category.updated_at),
    }));

    return NextResponse.json({
      categories: transformedCategories || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
