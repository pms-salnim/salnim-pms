import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET all rate plans for a property
// POST create a new rate plan
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
      .from('rate_plans')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching rate plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate plans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, name, description, isDefault, cancellationPolicy, freeCancellationUntil, nonRefundable } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { error: 'propertyId and name are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Generate ID
    const id = Buffer.from(`${propertyId}|${name}|${Date.now()}`).toString('base64').substring(0, 50);

    // If marking as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('rate_plans')
        .update({ is_default: false })
        .eq('property_id', propertyId)
        .neq('id', 'null');
    }

    const { data, error } = await supabase
      .from('rate_plans')
      .insert([
        {
          id,
          property_id: propertyId,
          name,
          description,
          is_default: isDefault || false,
          cancellation_policy: cancellationPolicy,
          free_cancellation_until: freeCancellationUntil,
          non_refundable: nonRefundable || false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating rate plan:', error);
    return NextResponse.json(
      { error: 'Failed to create rate plan' },
      { status: 500 }
    );
  }
}

// PUT update a rate plan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ratePlanId, name, description, isDefault, cancellationPolicy, freeCancellationUntil, nonRefundable, propertyId } = body;

    if (!ratePlanId || !propertyId) {
      return NextResponse.json(
        { error: 'ratePlanId and propertyId are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // If marking as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('rate_plans')
        .update({ is_default: false })
        .eq('property_id', propertyId)
        .neq('id', ratePlanId);
    }

    const { data, error } = await supabase
      .from('rate_plans')
      .update({
        name,
        description,
        is_default: isDefault,
        cancellation_policy: cancellationPolicy,
        free_cancellation_until: freeCancellationUntil,
        non_refundable: nonRefundable,
      })
      .eq('id', ratePlanId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating rate plan:', error);
    return NextResponse.json(
      { error: 'Failed to update rate plan' },
      { status: 500 }
    );
  }
}

// DELETE a rate plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ratePlanId = searchParams.get('id');

    if (!ratePlanId) {
      return NextResponse.json(
        { error: 'Rate plan id is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check if this rate plan has any daily rates
    const { count: rateCount } = await supabase
      .from('daily_rates')
      .select('*', { count: 'exact', head: true })
      .eq('rate_plan_id', ratePlanId);

    if (rateCount && rateCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete rate plan with existing rates. Please delete all rates first.' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('rate_plans')
      .delete()
      .eq('id', ratePlanId);

    if (error) throw error;

    return NextResponse.json({ message: 'Rate plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete rate plan' },
      { status: 500 }
    );
  }
}
