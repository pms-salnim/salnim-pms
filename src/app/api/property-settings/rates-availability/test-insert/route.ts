import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('[Test Insert API] Starting test insert...');

    const testPayload = {
      property_id: 'kyhZam7bFa3RdE2ygV4B',
      room_id: 'room_test_123',
      date: '2026-04-20',
      end_date: '2026-04-20',
      status: 'not_available',
      occupancy: 1,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    console.log('[Test Insert API] Insert payload:', testPayload);

    const { data, error } = await supabase
      .from('availability_calendar')
      .insert(testPayload)
      .select();

    console.log('[Test Insert API] Response:', { data, error });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        fullError: JSON.stringify(error),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('[Test Insert API] Exception:', err);
    return NextResponse.json({
      success: false,
      error: String(err),
    }, { status: 500 });
  }
}
