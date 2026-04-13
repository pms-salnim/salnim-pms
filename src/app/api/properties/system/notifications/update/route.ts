/**
 * API Route: /api/properties/system/notifications/update
 * Updates notification settings in Supabase PostgreSQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client for database access
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

export async function POST(request: NextRequest) {
  try {
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

    // Get request body
    const { propertyId, settings } = await request.json();

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings are required' },
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

    console.log('Updating notification settings:', {
      propertyId,
      settingsKeys: Object.keys(settings),
    });

    // Update property in database
    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from('properties')
      .update({ notification_settings: settings })
      .eq('id', propertyId)
      .select('notification_settings')
      .single();

    if (updateError || !updatedProperty) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update notification settings' },
        { status: 500 }
      );
    }

    console.log('Notification settings updated successfully:', propertyId);

    return NextResponse.json({
      success: true,
      settings: updatedProperty.notification_settings,
    });
  } catch (error: any) {
    console.error('Notification settings update API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
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

    // Fetch notification settings
    const { data: propertyData, error: fetchError } = await supabaseAdmin
      .from('properties')
      .select('notification_settings')
      .eq('id', propertyId)
      .single();

    if (fetchError || !propertyData) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError?.message || 'Failed to fetch notification settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: propertyData.notification_settings || {},
    });
  } catch (error: any) {
    console.error('Notification settings fetch API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}
