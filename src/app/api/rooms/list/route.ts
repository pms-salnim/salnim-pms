/**
 * API Route: /api/rooms/list
 * Fetch all rooms for a property from Supabase
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

    // Fetch rooms for the property
    let { data: rooms, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select(`
        *,
        room_types (
          id,
          name,
          max_guests,
          description,
          amenities,
          thumbnail_image_url,
          gallery_image_urls,
          beds,
          selected_amenities,
          number_of_rooms_available,
          assigned_room_numbers
        )
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message || 'Failed to fetch rooms' },
        { status: 500 }
      );
    }

    // Transform rooms from snake_case to camelCase to match Room interface
    const transformedRooms = (rooms || []).map((room: any) => {
      let roomType: any = null;
      
      // Transform room_types if it's a joined object
      if (room.room_types) {
        const rt = room.room_types;
        let amenitiesData: any = {};
        
        // Handle amenities data (could be in old format or new format)
        if (rt.amenities && typeof rt.amenities === 'object' && !Array.isArray(rt.amenities)) {
          amenitiesData = rt.amenities;
        } else if (typeof rt.amenities === 'string') {
          try {
            amenitiesData = JSON.parse(rt.amenities);
          } catch {
            amenitiesData = {};
          }
        } else {
          amenitiesData = {
            selectedAmenities: rt.selected_amenities || [],
            beds: rt.beds || [],
          };
        }
        
        roomType = {
          id: rt.id,
          name: rt.name,
          maxGuests: rt.max_guests,
          description: rt.description,
          selectedAmenities: amenitiesData.selectedAmenities || rt.selected_amenities || [],
          beds: amenitiesData.beds || rt.beds || [],
          numberOfRoomsAvailable: rt.number_of_rooms_available || amenitiesData.numberOfRoomsAvailable || null,
          assignedRoomNumbers: rt.assigned_room_numbers || amenitiesData.assignedRoomNumbers || [],
          thumbnailImageUrl: rt.thumbnail_image_url || amenitiesData.thumbnailImageUrl || '',
          galleryImageUrls: rt.gallery_image_urls || amenitiesData.galleryImageUrls || [],
        };
      }
      
      return {
        id: room.id,
        name: room.name,
        roomTypeId: room.room_type_id,
        propertyId: room.property_id,
        number: room.number,
        floor: room.floor,
        status: room.status,
        cleaningStatus: room.cleaning_status,
        notes: room.notes,
        amenities: room.amenities || [],
        createdAt: new Date(room.created_at),
        updatedAt: room.updated_at ? new Date(room.updated_at) : undefined,
        // Include the joined room type data if it exists
        ...(roomType && { room_types: roomType }),
      };
    });

    return NextResponse.json({
      rooms: transformedRooms || [],
    });
  } catch (error: any) {
    console.error('Rooms list API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}
