/**
 * API Route: /api/rooms/room-types/list
 * Fetch all room types for a property from Supabase
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

    // Fetch room types for the property
    const { data: roomTypes, error: fetchError } = await supabaseAdmin
      .from('room_types')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch room types' },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase
    const transformedRoomTypes = (roomTypes || []).map(rt => ({
      id: rt.id,
      name: rt.name,
      propertyId: rt.property_id,
      maxGuests: rt.max_guests,
      description: rt.description,
      numberOfRoomsAvailable: rt.number_of_rooms_available,
      assignedRoomNumbers: rt.assigned_room_numbers,
      selectedAmenities: rt.selected_amenities,
      beds: rt.beds,
      thumbnailImageUrl: rt.thumbnail_image_url,
      galleryImageUrls: rt.gallery_image_urls,
      createdAt: rt.created_at,
      updatedAt: rt.updated_at,
    }));

    return NextResponse.json({
      roomTypes: transformedRoomTypes || [],
    });
  } catch (error: any) {
    console.error('Room types list API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch room types' },
      { status: 500 }
    );
  }
}
