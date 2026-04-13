/**
 * API Route: /api/auth/me
 * Gets the current user's profile and property
 * Supports both Bearer token auth and cookie-based auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Initialize admin client inside function (not at module load time)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    let userId: string | null = null;

    // Try Bearer token first
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // Verify token with admin client
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data.user) {
        console.error('Bearer token verification failed:', error);
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      userId = data.user.id;
    } else {
      // Fallback to cookie-based auth
      const cookieStore = await cookies();
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
          },
        } as any
      );

      const { data: { user }, error } = await supabaseClient.auth.getUser();

      if (error || !user) {
        console.error('Cookie-based auth failed:', error?.message);
        return NextResponse.json(
          { error: 'Missing authorization' },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    // First try to get user profile from users table
    let { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // If not found in users table, try team_members table
    if (userError || !userProfile) {
      console.log('User not found in users table, checking team_members table');
      
      const { data: teamMember, error: teamError } = await supabaseAdmin
        .from('team_members')
        .select('*')
        .eq('id', userId)
        .single();

      if (teamError || !teamMember) {
        console.error('User not found in either users or team_members table:', userError);
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        );
      }

      // Convert team_member data to user format
      userProfile = {
        id: teamMember.id,
        email: teamMember.email,
        name: teamMember.full_name,
        role: teamMember.role,
        property_id: teamMember.property_id,
        phone: teamMember.phone,
        permissions: teamMember.permissions,
        status: teamMember.status,
        country: null,
        city: null,
        address: null,
        preferred_language: 'en',
      };
      
      console.log('Team member profile:', { 
        id: userProfile.id, 
        email: userProfile.email,
        status: userProfile.status,
        role: userProfile.role
      });
    }

    console.log('User profile:', { id: userProfile.id, property_id: userProfile.property_id });

    // Get property details if user has one
    let property = null;
    if (userProfile.property_id) {
      console.log('Fetching property with ID:', userProfile.property_id);
      
      const { data: propertyData, error: propError } = await supabaseAdmin
        .from('properties')
        .select('*')
        .eq('id', userProfile.property_id)
        .single();

      if (propError) {
        console.error('Property fetch failed:', propError);
      } else {
        console.log('Property fetched successfully:', propertyData?.id);
        property = propertyData;
      }
    } else {
      console.warn('User has no property_id set');
    }

    return NextResponse.json({
      user: userProfile,
      property,
    });
  } catch (error: any) {
    console.error('Get user API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
