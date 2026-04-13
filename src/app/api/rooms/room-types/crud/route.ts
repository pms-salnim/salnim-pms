/**
 * API Route: /api/rooms/room-types/crud
 * Create, update, and delete room types in Supabase
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

async function verifyUserProperty(userId: string, propertyId: string) {
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('property_id')
    .eq('id', userId)
    .single();

  if (userError || !userData || userData.property_id !== propertyId) {
    throw new Error('Unauthorized - property does not belong to user');
  }
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

    // Verify token
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { 
      action, 
      propertyId, 
      roomTypeId, 
      name, 
      description, 
      maxGuests, 
      amenities // Contains: selectedAmenities, beds, numberOfRoomsAvailable, assignedRoomNumbers, thumbnailImageUrl, galleryImageUrls
    } = await request.json();

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this property
    await verifyUserProperty(data.user.id, propertyId);

    // Parse amenities object to extract individual fields
    let parsedAmenities: Record<string, any> = {};
    if (typeof amenities === 'string') {
      try {
        parsedAmenities = JSON.parse(amenities);
      } catch {
        parsedAmenities = {};
      }
    } else if (typeof amenities === 'object' && amenities !== null) {
      parsedAmenities = amenities;
    }

    if (action === 'create') {
      // Generate a simple ID if not provided
      const id = roomTypeId || `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: newRoomType, error: createError } = await supabaseAdmin
        .from('room_types')
        .insert({
          id,
          property_id: propertyId,
          name: name || 'Unnamed Room Type',
          description: description || '',
          max_guests: maxGuests || 2,
          selected_amenities: parsedAmenities.selectedAmenities || [],
          beds: parsedAmenities.beds || [],
          number_of_rooms_available: parsedAmenities.numberOfRoomsAvailable || null,
          assigned_room_numbers: parsedAmenities.assignedRoomNumbers || [],
          thumbnail_image_url: parsedAmenities.thumbnailImageUrl || '',
          gallery_image_urls: parsedAmenities.galleryImageUrls || [],
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Create error:', createError);
        return NextResponse.json(
          { error: createError.message || 'Failed to create room type' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        roomType: newRoomType,
      });
    }

    if (action === 'update') {
      if (!roomTypeId) {
        return NextResponse.json(
          { error: 'Room type ID is required for update' },
          { status: 400 }
        );
      }

      const updatePayload: Record<string, any> = {};
      if (name !== undefined) updatePayload.name = name;
      if (description !== undefined) updatePayload.description = description;
      if (maxGuests !== undefined) updatePayload.max_guests = maxGuests;
      
      // Update individual amenity-related fields
      if (parsedAmenities.selectedAmenities !== undefined) updatePayload.selected_amenities = parsedAmenities.selectedAmenities;
      if (parsedAmenities.beds !== undefined) updatePayload.beds = parsedAmenities.beds;
      if (parsedAmenities.numberOfRoomsAvailable !== undefined) updatePayload.number_of_rooms_available = parsedAmenities.numberOfRoomsAvailable;
      if (parsedAmenities.assignedRoomNumbers !== undefined) updatePayload.assigned_room_numbers = parsedAmenities.assignedRoomNumbers;
      if (parsedAmenities.thumbnailImageUrl !== undefined) updatePayload.thumbnail_image_url = parsedAmenities.thumbnailImageUrl;
      if (parsedAmenities.galleryImageUrls !== undefined) updatePayload.gallery_image_urls = parsedAmenities.galleryImageUrls;

      const { data: updatedRoomType, error: updateError } = await supabaseAdmin
        .from('room_types')
        .update(updatePayload)
        .eq('id', roomTypeId)
        .eq('property_id', propertyId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return NextResponse.json(
          { error: updateError.message || 'Failed to update room type' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        roomType: updatedRoomType,
      });
    }

    if (action === 'delete') {
      if (!roomTypeId) {
        return NextResponse.json(
          { error: 'Room type ID is required for delete' },
          { status: 400 }
        );
      }

      // Check if any rooms are assigned to this room type
      const { data: dependentRooms, error: checkError } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('room_type_id', roomTypeId)
        .eq('property_id', propertyId);

      if (checkError) {
        console.error('Error checking dependent rooms:', checkError);
        return NextResponse.json(
          { error: 'Failed to verify room dependencies' },
          { status: 500 }
        );
      }

      // If rooms exist with this room type, cannot delete
      if (dependentRooms && dependentRooms.length > 0) {
        return NextResponse.json(
          { 
            error: `Cannot delete room type - ${dependentRooms.length} room(s) are assigned to this type. Please reassign or delete those rooms first.`,
            dependentRoomCount: dependentRooms.length
          },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from('room_types')
        .delete()
        .eq('id', roomTypeId)
        .eq('property_id', propertyId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message || 'Failed to delete room type' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Room type deleted successfully',
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Room types CRUD API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process room type operation' },
      { status: 500 }
    );
  }
}
