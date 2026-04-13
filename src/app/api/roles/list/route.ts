import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('property_id');
    const status = searchParams.get('status');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('roles')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status && ['active', 'inactive'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Transform snake_case to camelCase
    const transformedData = data?.map((role: any) => ({
      id: role.id,
      propertyId: role.property_id,
      name: role.name,
      description: role.description,
      permissions: role.permissions || {},
      status: role.status,
      createdAt: role.created_at ? new Date(role.created_at).toISOString() : null,
      updatedAt: role.updated_at ? new Date(role.updated_at).toISOString() : null,
    })) || [];

    return NextResponse.json({ roles: transformedData });
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
