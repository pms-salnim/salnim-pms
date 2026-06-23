import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ConversationSearchResult = {
  id: string;
  type: 'guest' | 'reservation';
  guestName: string;
  email: string;
  phone: string;
  reservationId?: string;
  reservationNumber?: string;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const normalizeText = (value: unknown): string => String(value || '').trim();

const buildCombinedName = (...parts: Array<unknown>): string =>
  parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildCommaName = (firstName: unknown, lastName: unknown): string => {
  const first = normalizeText(firstName);
  const last = normalizeText(lastName);
  if (!first && !last) return '';
  if (!first) return last;
  if (!last) return first;
  return `${first}, ${last}`;
};

const valueMatches = (query: string, value: unknown): boolean => {
  const normalizedQuery = normalizeText(query).toLowerCase();
  if (!normalizedQuery) return true;
  return normalizeText(value).toLowerCase().includes(normalizedQuery);
};

const hasCommunicationDetails = (email: unknown, phone: unknown): boolean =>
  Boolean(normalizeText(email) || normalizeText(phone));

const guestNameFromRow = (guest: any): string =>
  normalizeText(guest?.name)
  || normalizeText(guest?.full_name)
  || buildCombinedName(guest?.first_name, guest?.last_name)
  || normalizeText(guest?.email)
  || 'Guest';

const reservationNameFromRow = (reservation: any): string =>
  normalizeText(reservation?.guest_name)
  || buildCombinedName(reservation?.guest_first_name, reservation?.guest_last_name)
  || buildCombinedName(reservation?.first_name, reservation?.last_name)
  || normalizeText(reservation?.guest_email)
  || 'Guest';

const guestMatchesQuery = (guest: any, query: string): boolean => {
  const firstName = normalizeText(guest?.first_name);
  const lastName = normalizeText(guest?.last_name);
  const candidates = [
    guest?.name,
    guest?.full_name,
    buildCombinedName(firstName, lastName),
    buildCommaName(firstName, lastName),
    guest?.email,
    guest?.phone,
  ];
  return candidates.some((candidate) => valueMatches(query, candidate));
};

const reservationMatchesQuery = (reservation: any, query: string): boolean => {
  const firstName = normalizeText(reservation?.guest_first_name || reservation?.first_name);
  const lastName = normalizeText(reservation?.guest_last_name || reservation?.last_name);
  const candidates = [
    reservation?.guest_name,
    buildCombinedName(firstName, lastName),
    buildCommaName(firstName, lastName),
    reservation?.guest_email,
    reservation?.guest_phone,
    reservation?.reservation_number,
  ];
  return candidates.some((candidate) => valueMatches(query, candidate));
};

async function verifyUserProperty(userId: string, propertyId: string) {
  const fromUsers = await supabaseAdmin
    .from('users')
    .select('property_id')
    .eq('id', userId)
    .maybeSingle();

  if (fromUsers.data?.property_id === propertyId) {
    return;
  }

  const fromTeamMembers = await supabaseAdmin
    .from('team_members')
    .select('property_id')
    .eq('id', userId)
    .maybeSingle();

  if (fromTeamMembers.data?.property_id === propertyId) {
    return;
  }

  throw new Error('Forbidden');
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const propertyId = normalizeText(body?.propertyId);
    const rawQuery = String(body?.query || '');
    const query = rawQuery.trim().replace(/%/g, '');

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    await verifyUserProperty(authData.user.id, propertyId);

    const isSearchMode = query.length >= 2;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reservationsQuery = supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId);

    const guestsQuery = supabaseAdmin
      .from('guests')
      .select('*')
      .eq('property_id', propertyId);

    if (isSearchMode) {
      reservationsQuery.order('updated_at', { ascending: false }).limit(120);
      guestsQuery.order('updated_at', { ascending: false }).limit(120);
    } else {
      reservationsQuery
        .gte('end_date', thirtyDaysAgo)
        .order('start_date', { ascending: false })
        .limit(15);
      guestsQuery.order('updated_at', { ascending: false }).limit(10);
    }

    const [reservationsResponse, guestsResponse] = await Promise.all([reservationsQuery, guestsQuery]);

    if (reservationsResponse.error) {
      return NextResponse.json({
        error: 'Failed to load reservations',
        details: reservationsResponse.error.message,
        code: reservationsResponse.error.code,
      }, { status: 500 });
    }

    if (guestsResponse.error) {
      return NextResponse.json({
        error: 'Failed to load guests',
        details: guestsResponse.error.message,
        code: guestsResponse.error.code,
      }, { status: 500 });
    }

    const reservationResults: ConversationSearchResult[] = (reservationsResponse.data || [])
      .filter((reservation: any) => hasCommunicationDetails(reservation?.guest_email, reservation?.guest_phone))
      .filter((reservation: any) => (isSearchMode ? reservationMatchesQuery(reservation, query) : true))
      .map((reservation: any) => ({
        id: `reservation-${reservation.id}`,
        type: 'reservation',
        guestName: reservationNameFromRow(reservation),
        email: normalizeText(reservation.guest_email),
        phone: normalizeText(reservation.guest_phone),
        reservationId: String(reservation.id || ''),
        reservationNumber: String(reservation.reservation_number || ''),
      }));

    const guestResults: ConversationSearchResult[] = (guestsResponse.data || [])
      .filter((guest: any) => hasCommunicationDetails(guest?.email, guest?.phone))
      .filter((guest: any) => (isSearchMode ? guestMatchesQuery(guest, query) : true))
      .map((guest: any) => ({
        id: `guest-${guest.id}`,
        type: 'guest',
        guestName: guestNameFromRow(guest),
        email: normalizeText(guest.email),
        phone: normalizeText(guest.phone),
      }));

    const merged = [...reservationResults, ...guestResults];
    const deduped = merged.filter((item, index, all) => {
      const key = `${item.type}:${item.guestName}:${item.email}:${item.phone}:${item.reservationId || ''}`.toLowerCase();
      return all.findIndex((candidate) => `${candidate.type}:${candidate.guestName}:${candidate.email}:${candidate.phone}:${candidate.reservationId || ''}`.toLowerCase() === key) === index;
    });

    return NextResponse.json({
      results: deduped.slice(0, isSearchMode ? 20 : 25),
    });
  } catch (error: any) {
    const message = error?.message || 'Internal server error';
    const status = message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}