import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET rooms for a property
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Fetch all rooms (all statuses) - user can see and manage any room's availability
    const { data, error } = await supabase
      .from('rooms')
      .select('id, number, name, room_type_id, status')
      .eq('property_id', propertyId)
      .order('number', { ascending: true });

    if (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }

    console.log('Rooms query result:', {
      count: data?.length,
      statuses: data?.map((r: any) => r.status),
      sampleRoom: data?.[0],
    });

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error in rooms endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms', details: (error as any)?.message },
      { status: 500 }
    );
  }
}
