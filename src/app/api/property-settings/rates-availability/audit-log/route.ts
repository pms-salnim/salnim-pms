import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET audit logs for property (read-only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const tableName = searchParams.get('tableName');
    const action = searchParams.get('action');
    const limit = searchParams.get('limit') || '100';

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('rates_audit_log')
      .select('*')
      .eq('property_id', propertyId)
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (tableName) query = query.eq('table_name', tableName);
    if (action) query = query.eq('action', action);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// GET single record's audit history
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, recordId } = body;

    if (!propertyId || !recordId) {
      return NextResponse.json(
        { error: 'propertyId and recordId are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('rates_audit_log')
      .select('*')
      .eq('property_id', propertyId)
      .eq('record_id', recordId)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching record audit history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch record audit history' },
      { status: 500 }
    );
  }
}
