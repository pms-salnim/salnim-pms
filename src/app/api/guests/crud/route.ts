import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function generateGuestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function verifyUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  return data.user;
}

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

    const user = await verifyUser(token);

    const body = await request.json();
    const { action, propertyId } = body;

    if (!action || !propertyId) {
      return NextResponse.json({ error: 'action and propertyId are required' }, { status: 400 });
    }

    await verifyUserProperty(user.id, propertyId);

    if (action === 'create') {
      const { guest } = body;
      if (!guest) {
        return NextResponse.json({ error: 'guest payload is required' }, { status: 400 });
      }

      const guestToInsert = {
        id: guest.id || generateGuestId(),
        ...guest,
        property_id: propertyId,
      };

      const { data, error } = await supabaseAdmin
        .from('guests')
        .insert(guestToInsert)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
      }

      return NextResponse.json({ guest: data });
    }

    if (action === 'update') {
      const { guestId, guest } = body;
      if (!guestId || !guest) {
        return NextResponse.json({ error: 'guestId and guest payload are required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('guests')
        .update(guest)
        .eq('id', guestId)
        .eq('property_id', propertyId)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
      }

      return NextResponse.json({ guest: data });
    }

    if (action === 'delete') {
      const { guestId } = body;
      if (!guestId) {
        return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('guests')
        .delete()
        .eq('id', guestId)
        .eq('property_id', propertyId);

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'bulkDelete') {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('guests')
        .delete()
        .eq('property_id', propertyId)
        .in('id', ids);

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'enroll') {
      const { guestId } = body;
      if (!guestId) {
        return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('guests')
        .update({ loyalty_status: 'enrolled', updated_at: new Date().toISOString() })
        .eq('id', guestId)
        .eq('property_id', propertyId)
        .select('id')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
      }

      return NextResponse.json({ success: true, guest: data });
    }

    if (action === 'bulkEnroll') {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('guests')
        .update({ loyalty_status: 'enrolled', updated_at: new Date().toISOString() })
        .eq('property_id', propertyId)
        .in('id', ids);

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    const message = error?.message || 'Internal server error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
