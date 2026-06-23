/**
 * API Route: GET /api/reservations/list
 * Fetch all reservations for a property from Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function transformReservation(r: any) {
  return {
    id: r.id,
    propertyId: r.property_id,
    guestId: r.guest_id || null,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
    guestCountry: r.guest_country,
    guestPassportOrId: r.guest_passport_id,
    source: r.source,
    status: r.status,
    reservationNumber: r.reservation_number,
    startDate: r.start_date,   // ISO date string – caller converts to Date
    endDate: r.end_date,
    rooms: r.rooms_data || [],
    selectedExtras: r.selected_extras || [],
    totalPrice: r.total_price,
    priceBeforeDiscount: r.price_before_discount,
    discountAmount: r.discount_amount,
    roomsTotal: r.rooms_total,
    extrasTotal: r.extras_total,
    subtotal: (r.rooms_total ?? 0) + (r.extras_total ?? 0),
    taxAmount: r.tax_amount,
    netAmount: (r.rooms_total ?? 0) + (r.extras_total ?? 0) - (r.discount_amount ?? 0),
    paymentStatus: r.payment_status,
    partialPaymentAmount: r.partial_payment_amount,
    paidWithPoints: r.paid_with_points,
    promotionApplied: r.promotion_applied,
    packageInfo: r.package_info,
    notes: r.notes,
    color: r.color,
    groupBooking: r.group_booking ?? r.groupBooking ?? false,
    groupName: r.group_name ?? r.groupName ?? null,
    companyName: r.company_name ?? r.companyName ?? null,
    actualCheckInTime: r.actual_check_in_time,
    actualCheckOutTime: r.actual_check_out_time,
    isCheckedOut: r.is_checked_out || false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function isMissingReservationsTableError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.reservations'") ||
    message.includes('relation "public.reservations" does not exist') ||
    message.includes('relation "reservations" does not exist')
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Verify user owns this property
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('property_id')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData || userData.property_id !== propertyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: reservations, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      if (isMissingReservationsTableError(fetchError)) {
        return NextResponse.json({
          reservations: [],
          warning: 'reservations_table_missing',
          details: fetchError.message,
        });
      }

      console.error('[reservations/list] fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      reservations: (reservations || []).map(transformReservation),
    });
  } catch (error: any) {
    console.error('[reservations/list] unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
