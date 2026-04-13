import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET room types for a property
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

    const { data, error } = await supabase
      .from('room_types')
      .select('id, name')
      .eq('property_id', propertyId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching room types:', error);
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error in room types endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room types', details: (error as any)?.message },
      { status: 500 }
    );
  }
}
