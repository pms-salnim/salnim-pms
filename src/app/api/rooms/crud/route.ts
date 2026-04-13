/**
 * API Route: /api/rooms/crud
 * Create, update, and delete rooms in Supabase
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

    const { action, propertyId, roomId, roomTypeId, name, number, floor, status, cleaningStatus, notes, amenities } = await request.json();

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this property
    await verifyUserProperty(data.user.id, propertyId);

    if (action === 'create') {
      const id = roomId || `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: newRoom, error: createError } = await supabaseAdmin
        .from('rooms')
        .insert({
          id,
          property_id: propertyId,
          room_type_id: roomTypeId,
          name: name || 'Unnamed Room',
          number: number || null,
          floor: floor || null,
          status: status || 'Available',
          cleaning_status: cleaningStatus || 'clean',
          notes: notes || '',
          amenities: amenities || [],
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Create error:', createError);
        return NextResponse.json(
          { error: createError.message || 'Failed to create room' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        room: newRoom,
      });
    }

    if (action === 'update') {
      if (!roomId) {
        return NextResponse.json(
          { error: 'Room ID is required for update' },
          { status: 400 }
        );
      }

      const updatePayload: Record<string, any> = {};
      if (name !== undefined) updatePayload.name = name;
      if (number !== undefined) updatePayload.number = number;
      if (floor !== undefined) updatePayload.floor = floor;
      if (status !== undefined) updatePayload.status = status;
      if (cleaningStatus !== undefined) updatePayload.cleaning_status = cleaningStatus;
      if (notes !== undefined) updatePayload.notes = notes;
      if (amenities !== undefined) updatePayload.amenities = amenities;

      const { data: updatedRoom, error: updateError } = await supabaseAdmin
        .from('rooms')
        .update(updatePayload)
        .eq('id', roomId)
        .eq('property_id', propertyId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return NextResponse.json(
          { error: updateError.message || 'Failed to update room' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        room: updatedRoom,
      });
    }

    if (action === 'delete') {
      if (!roomId) {
        return NextResponse.json(
          { error: 'Room ID is required for delete' },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from('rooms')
        .delete()
        .eq('id', roomId)
        .eq('property_id', propertyId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message || 'Failed to delete room' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Room deleted successfully',
      });
    }

    if (action === 'bulk-update') {
      // Handle bulk updates for multiple rooms
      const { roomIds, updates } = await request.json();
      
      if (!roomIds || !Array.isArray(roomIds)) {
        return NextResponse.json(
          { error: 'roomIds array is required for bulk-update' },
          { status: 400 }
        );
      }

      const updatePayload: Record<string, any> = {};
      if (updates.floor !== undefined) updatePayload.floor = updates.floor;
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.cleaningStatus !== undefined) updatePayload.cleaning_status = updates.cleaningStatus;
      if (updates.notes !== undefined) updatePayload.notes = updates.notes;
      if (updates.amenities !== undefined) updatePayload.amenities = updates.amenities;

      const { error: updateError } = await supabaseAdmin
        .from('rooms')
        .update(updatePayload)
        .in('id', roomIds)
        .eq('property_id', propertyId);

      if (updateError) {
        console.error('Bulk update error:', updateError);
        return NextResponse.json(
          { error: updateError.message || 'Failed to bulk update rooms' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${roomIds.length} rooms`,
      });
    }

    if (action === 'bulk-delete') {
      // Handle bulk deletes for multiple rooms
      const { roomIds } = await request.json();
      
      if (!roomIds || !Array.isArray(roomIds)) {
        return NextResponse.json(
          { error: 'roomIds array is required for bulk-delete' },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from('rooms')
        .delete()
        .in('id', roomIds)
        .eq('property_id', propertyId);

      if (deleteError) {
        console.error('Bulk delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message || 'Failed to bulk delete rooms' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${roomIds.length} rooms`,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Rooms CRUD API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process room operation' },
      { status: 500 }
    );
  }
}
