/**
 * API Route: /api/properties/system/preferences/update
 * Updates preference settings in Supabase PostgreSQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createSupabaseClientForRequest(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are missing');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

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
    const supabaseAdmin = createSupabaseClientForRequest(token);

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

    console.log('Updating preference settings:', {
      propertyId,
      settingsKeys: Object.keys(settings),
    });

    // Update property in database
    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from('properties')
      .update({ preference_settings: settings })
      .eq('id', propertyId)
      .select('preference_settings')
      .single();

    if (updateError || !updatedProperty) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update preference settings' },
        { status: 500 }
      );
    }

    console.log('Preference settings updated successfully:', propertyId);

    return NextResponse.json({
      success: true,
      settings: updatedProperty.preference_settings,
    });
  } catch (error: any) {
    console.error('Preference settings update API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update preference settings' },
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
    const supabaseAdmin = createSupabaseClientForRequest(token);

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

    // Fetch the full row to avoid hard failures when optional columns differ across environments.
    const { data: propertyData, error: fetchError } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (fetchError || !propertyData) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError?.message || 'Failed to fetch preference settings' },
        { status: 500 }
      );
    }

    const rawPreferenceSettings = (propertyData as any)?.preference_settings;
    const fallbackBookingPageSettings = (propertyData as any)?.booking_page_settings;

    const normalizedSettings =
      rawPreferenceSettings && typeof rawPreferenceSettings === 'object'
        ? rawPreferenceSettings
        : (
            fallbackBookingPageSettings
            && typeof fallbackBookingPageSettings === 'object'
            && typeof fallbackBookingPageSettings.allowSameDayTurnover === 'boolean'
          )
          ? { allowSameDayTurnover: fallbackBookingPageSettings.allowSameDayTurnover }
          : {};

    return NextResponse.json({
      settings: normalizedSettings,
    });
  } catch (error: any) {
    console.error('Preference settings fetch API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch preference settings' },
      { status: 500 }
    );
  }
}
