/**
 * API Route: POST /api/reservations/crud
 * Create, update, check-in, and check-out reservations in Supabase.
 *
 * Supported actions:
 *   - update      : update dates / room / pricing (drag-drop / resize)
 *   - checkIn     : mark reservation as Checked-in
 *   - checkOut    : mark reservation as Completed, set room Dirty, create housekeeping task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  return data.user;
}

async function verifyUserProperty(userId: string, propertyId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('property_id')
    .eq('id', userId)
    .single();
  if (error || !data || data.property_id !== propertyId) throw new Error('Forbidden');
}

async function generateReservationNumber(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = String(Math.floor(100000000 + Math.random() * 900000000));

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('reservation_number', candidate)
      .maybeSingle();

    if (error) {
      continue;
    }

    if (!data) {
      return candidate;
    }
  }

  return String(Date.now()).slice(-9);
}

function isMissingColumnError(error: any, columnName: string): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes(`could not find the '${columnName.toLowerCase()}' column`) ||
    message.includes(`column "${columnName.toLowerCase()}" does not exist`) ||
    message.includes(`column ${columnName.toLowerCase()} does not exist`)
  );
}

function extractMissingColumnName(error: any): string | null {
  const message = String(error?.message || '');
  const schemaCacheMatch = message.match(/could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const postgresMatch = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (postgresMatch?.[1]) return postgresMatch[1];

  return null;
}

async function insertReservationWithFallback(payload: Record<string, any>) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await supabaseAdmin
      .from('reservations')
      .insert(currentPayload)
      .select('id')
      .single();

    if (!result.error) {
      return result;
    }

    const missingColumn = extractMissingColumnName(result.error);
    if (!missingColumn || !(missingColumn in currentPayload)) {
      return result;
    }

    const fallbackPayload = { ...currentPayload };
    delete fallbackPayload[missingColumn];
    currentPayload = fallbackPayload;
  }

  return {
    data: null,
    error: { message: 'Failed to insert reservation after schema fallback retries.' },
  } as any;
}

async function updateReservationWithFallback(
  payload: Record<string, any>,
  reservationId: string,
  propertyId: string
) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await supabaseAdmin
      .from('reservations')
      .update(currentPayload)
      .eq('id', reservationId)
      .eq('property_id', propertyId);

    if (!result.error) {
      return result;
    }

    const missingColumn = extractMissingColumnName(result.error);
    if (!missingColumn || !(missingColumn in currentPayload)) {
      return result;
    }

    const fallbackPayload = { ...currentPayload };
    delete fallbackPayload[missingColumn];
    currentPayload = fallbackPayload;
  }

  return {
    error: { message: 'Failed to update reservation after schema fallback retries.' },
  } as any;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = new Date(startA);
  const aEnd = new Date(endA);
  const bStart = new Date(startB);
  const bEnd = new Date(endB);
  // Checkout-exclusive overlap check: [start, end)
  return aStart < bEnd && aEnd > bStart;
}

async function autoAssignRoomsForCreate(
  propertyId: string,
  rooms: any[],
  reservationStartDate: string,
  reservationEndDate: string
): Promise<any[]> {
  const needsAssignment = rooms.some((room) => !room.roomId && !!room.roomTypeId);
  if (!needsAssignment) return rooms;

  const roomTypeIds = Array.from(new Set(rooms.map((room) => room.roomTypeId).filter(Boolean)));
  if (roomTypeIds.length === 0) return rooms;

  const { data: roomData, error: roomsError } = await supabaseAdmin
    .from('rooms')
    .select('id, name, room_type_id')
    .eq('property_id', propertyId)
    .in('room_type_id', roomTypeIds);

  if (roomsError) {
    throw new Error(`Failed to load rooms for assignment: ${roomsError.message}`);
  }

  const roomsByType = new Map<string, Array<{ id: string; name?: string | null; room_type_id: string }>>();
  (roomData ?? []).forEach((room: any) => {
    const typeRooms = roomsByType.get(room.room_type_id) ?? [];
    typeRooms.push(room);
    roomsByType.set(room.room_type_id, typeRooms);
  });

  const minSearchDate = reservationStartDate;
  const maxSearchDate = reservationEndDate;

  const { data: reservationRows, error: reservationsError } = await supabaseAdmin
    .from('reservations')
    .select('id, status, start_date, end_date, rooms_data')
    .eq('property_id', propertyId)
    .lte('start_date', maxSearchDate)
    .gt('end_date', minSearchDate);

  if (reservationsError) {
    throw new Error(`Failed to load existing reservations for assignment: ${reservationsError.message}`);
  }

  const inactiveStatuses = new Set(['canceled', 'cancelled', 'no-show', 'completed']);
  const occupiedByRoom = new Map<string, Array<{ start: string; end: string }>>();

  (reservationRows ?? []).forEach((reservation: any) => {
    const reservationStatus = String(reservation.status || '').toLowerCase();
    if (inactiveStatuses.has(reservationStatus)) return;

    const entries = Array.isArray(reservation.rooms_data) ? reservation.rooms_data : [];
    entries.forEach((entry: any) => {
      const roomId = entry?.roomId;
      if (!roomId) return;

      const start = entry.segmentStartDate || reservation.start_date;
      const end = entry.segmentEndDate || reservation.end_date;
      if (!start || !end) return;

      const existing = occupiedByRoom.get(roomId) ?? [];
      existing.push({ start, end });
      occupiedByRoom.set(roomId, existing);
    });
  });

  // Track assignments inside this same reservation request as well.
  const assignedInRequest = new Map<string, Array<{ start: string; end: string }>>();
  rooms.forEach((room) => {
    if (!room.roomId) return;
    const start = room.segmentStartDate || reservationStartDate;
    const end = room.segmentEndDate || reservationEndDate;
    const existing = assignedInRequest.get(room.roomId) ?? [];
    existing.push({ start, end });
    assignedInRequest.set(room.roomId, existing);
  });

  const roomsToAssign = [...rooms]
    .map((room, index) => ({ room, index }))
    .sort((a, b) => {
      const aStart = a.room.segmentStartDate || reservationStartDate;
      const bStart = b.room.segmentStartDate || reservationStartDate;
      return String(aStart).localeCompare(String(bStart));
    });

  for (const item of roomsToAssign) {
    const room = item.room;
    if (room.roomId || !room.roomTypeId) continue;

    const segStart = room.segmentStartDate || reservationStartDate;
    const segEnd = room.segmentEndDate || reservationEndDate;

    const candidates = (roomsByType.get(room.roomTypeId) ?? []).sort((a, b) =>
      String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { numeric: true })
    );

    const selected = candidates.find((candidate) => {
      const occupied = occupiedByRoom.get(candidate.id) ?? [];
      const internal = assignedInRequest.get(candidate.id) ?? [];
      const hasOccupiedOverlap = occupied.some((range) => rangesOverlap(segStart, segEnd, range.start, range.end));
      if (hasOccupiedOverlap) return false;
      const hasInternalOverlap = internal.some((range) => rangesOverlap(segStart, segEnd, range.start, range.end));
      return !hasInternalOverlap;
    });

    if (!selected) {
      throw new Error(`No available room found for ${room.roomTypeName || room.roomTypeId} (${segStart} to ${segEnd}).`);
    }

    rooms[item.index] = {
      ...room,
      roomId: selected.id,
      roomName: selected.name || selected.id,
    };

    const internal = assignedInRequest.get(selected.id) ?? [];
    internal.push({ start: segStart, end: segEnd });
    assignedInRequest.set(selected.id, internal);
  }

  return rooms;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const user = await verifyUser(token);

    const body = await request.json();
    const { action, propertyId, reservationId } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    if (action !== 'create' && !reservationId) {
      return NextResponse.json({ error: 'reservationId is required' }, { status: 400 });
    }

    await verifyUserProperty(user.id, propertyId);

    // ----------------------------------------------------------------
    // ACTION: create (reservation form)
    // ----------------------------------------------------------------
    if (action === 'create') {
      const {
        guestId,
        guestName,
        guestEmail,
        guestPhone,
        guestCountry,
        guestPassportOrId,
        startDate,
        endDate,
        status,
        paymentStatus,
        partialPaymentAmount,
        source,
        rooms,
        roomsTotal,
        extrasTotal,
        subtotal,
        discountAmount,
        taxAmount,
        totalPrice,
        notes,
        promotionApplied,
        reservationNumber,
      } = body;

      if (!guestName || !startDate || !endDate || !Array.isArray(rooms) || rooms.length === 0) {
        return NextResponse.json(
          { error: 'guestName, startDate, endDate, and at least one room are required' },
          { status: 400 }
        );
      }

      const derivedNights = Math.max(
        1,
        Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      const firstRoom = rooms[0] || {};
      const derivedAdultCount = Number.isFinite(Number(firstRoom.adults))
        ? Math.max(1, Number(firstRoom.adults))
        : 1;
      const derivedChildrenCount = Number.isFinite(Number(firstRoom.children))
        ? Math.max(0, Number(firstRoom.children))
        : 0;

      let normalizedRooms = rooms.map((room: any, index: number) => {
        const roomStartDate = room.segmentStartDate || startDate;
        const roomEndDate = room.segmentEndDate || endDate;
        const roomNights = Math.max(
          1,
          Math.ceil(
            (new Date(roomEndDate).getTime() - new Date(roomStartDate).getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        const roomTotal = Number.isFinite(Number(room.price)) ? Number(room.price) : 0;
        const roomRate = roomNights > 0 ? roomTotal / roomNights : roomTotal;

        return {
          ...room,
          id: room.id || `${Date.now()}-${index}`,
          segmentStartDate: roomStartDate,
          segmentEndDate: roomEndDate,
          roomNights,
          roomRate,
          roomTotal,
        };
      });

      try {
        normalizedRooms = await autoAssignRoomsForCreate(propertyId, normalizedRooms, startDate, endDate);
      } catch (assignmentError: any) {
        return NextResponse.json(
          { error: assignmentError?.message || 'Could not auto-assign rooms for this reservation.' },
          { status: 409 }
        );
      }

      const insertPayload: any = {
        id: body.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        property_id: propertyId,
        guest_id: guestId || null,
        guest_name: guestName,
        guest_email: guestEmail || null,
        guest_phone: guestPhone || null,
        guest_country: guestCountry || null,
        guest_passport_id: guestPassportOrId || null,
        source: source || 'Direct',
        reservation_number: reservationNumber || await generateReservationNumber(),
        status: status || 'Pending',
        start_date: startDate,
        end_date: endDate,
        nights: derivedNights,
        adult_count: derivedAdultCount,
        children_count: derivedChildrenCount,
        baby_count: 0,
        rooms_data: normalizedRooms,
        rooms_total: roomsTotal ?? 0,
        extras_total: extrasTotal ?? 0,
        price_before_discount: subtotal ?? 0,
        discount_amount: discountAmount ?? 0,
        tax_amount: taxAmount ?? 0,
        total_price: totalPrice ?? 0,
        payment_status: paymentStatus || 'Pending',
        partial_payment_amount: partialPaymentAmount ?? 0,
        notes: notes || null,
        promotion_applied: promotionApplied || null,
        is_checked_out: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await insertReservationWithFallback(insertPayload);

      if (error) {
        console.error('[reservations/crud] create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, id: data?.id || null });
    }

    // ----------------------------------------------------------------
    // ACTION: updateForm (reservation form full update)
    // ----------------------------------------------------------------
    if (action === 'updateForm') {
      const {
        guestId,
        guestName,
        guestEmail,
        guestPhone,
        guestCountry,
        guestPassportOrId,
        startDate,
        endDate,
        status,
        paymentStatus,
        partialPaymentAmount,
        source,
        rooms,
        roomsTotal,
        extrasTotal,
        subtotal,
        discountAmount,
        taxAmount,
        totalPrice,
        notes,
        promotionApplied,
      } = body;

      const updatePayload: any = {
        guest_id: guestId || null,
        guest_name: guestName || null,
        guest_email: guestEmail || null,
        guest_phone: guestPhone || null,
        guest_country: guestCountry || null,
        guest_passport_id: guestPassportOrId || null,
        source: source || 'Direct',
        status: status || 'Pending',
        start_date: startDate,
        end_date: endDate,
        rooms_data: Array.isArray(rooms) ? rooms : [],
        rooms_total: roomsTotal ?? 0,
        extras_total: extrasTotal ?? 0,
        price_before_discount: subtotal ?? 0,
        discount_amount: discountAmount ?? 0,
        tax_amount: taxAmount ?? 0,
        total_price: totalPrice ?? 0,
        payment_status: paymentStatus || 'Pending',
        partial_payment_amount: partialPaymentAmount ?? 0,
        notes: notes || null,
        promotion_applied: promotionApplied || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await updateReservationWithFallback(updatePayload, reservationId, propertyId);

      if (error) {
        console.error('[reservations/crud] updateForm error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ----------------------------------------------------------------
    // ACTION: update (drag-drop / resize)
    // ----------------------------------------------------------------
    if (action === 'update') {
      const {
        startDate, endDate,
        roomId, roomName, roomTypeId, roomTypeName,
        ratePlanId, ratePlanName,
        totalPrice, roomsTotal, extrasTotal,
        subtotal, discountAmount, taxAmount, netAmount,
        existingRoomsData,
      } = body;

      const updatedRoom = {
        ...(existingRoomsData?.[0] || {}),
        roomId,
        roomName,
        roomTypeId,
        roomTypeName,
        ratePlanId: ratePlanId || existingRoomsData?.[0]?.ratePlanId,
        ratePlanName: ratePlanName || existingRoomsData?.[0]?.ratePlanName,
        pricingMode: 'rate_plan',
      };

      const updateMutationPayload: any = {
        start_date: startDate,
        end_date: endDate,
        rooms_data: [updatedRoom],
        total_price: totalPrice,
        rooms_total: roomsTotal,
        extras_total: extrasTotal,
        price_before_discount: subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        updated_at: new Date().toISOString(),
      };

      const { error } = await updateReservationWithFallback(updateMutationPayload, reservationId, propertyId);

      if (error) {
        console.error('[reservations/crud] update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ----------------------------------------------------------------
    // ACTION: checkIn
    // ----------------------------------------------------------------
    if (action === 'checkIn') {
      const { error } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'Checked-in',
          actual_check_in_time: new Date().toISOString(),
          is_checked_out: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId)
        .eq('property_id', propertyId);

      if (error) {
        console.error('[reservations/crud] checkIn error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ----------------------------------------------------------------
    // ACTION: checkOut
    // ----------------------------------------------------------------
    if (action === 'checkOut') {
      const { roomId, roomName, roomTypeName, guestName, createdByName, createdByUid, floor } = body;

      // 1. Update reservation
      const { error: resError } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'Completed',
          actual_check_out_time: new Date().toISOString(),
          is_checked_out: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId)
        .eq('property_id', propertyId);

      if (resError) {
        console.error('[reservations/crud] checkOut reservation error:', resError);
        return NextResponse.json({ error: resError.message }, { status: 500 });
      }

      // 2. Update room status to Dirty
      if (roomId) {
        const { error: roomError } = await supabaseAdmin
          .from('rooms')
          .update({ status: 'Dirty', updated_at: new Date().toISOString() })
          .eq('id', roomId)
          .eq('property_id', propertyId);

        if (roomError) {
          console.error('[reservations/crud] checkOut room update error:', roomError);
          // Non-fatal – continue
        }
      }

      // 3. Create housekeeping task
      const { error: taskError } = await supabaseAdmin
        .from('tasks')
        .insert({
          property_id: propertyId,
          room_id: roomId || null,
          title: `Clean Room: ${roomName || 'Unknown Room'}`,
          description: `Standard checkout cleaning for room ${roomName} (${roomTypeName}). Guest: ${guestName}.`,
          priority: 'High',
          status: 'Open',
          assigned_to_role: 'housekeeping',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (taskError) {
        console.error('[reservations/crud] task creation error:', taskError);
        // Non-fatal – continue
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[reservations/crud] unexpected error:', error);
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
