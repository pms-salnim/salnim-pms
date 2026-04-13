import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST: Handle bulk operations
// Supports: apply-pattern, copy-rates, apply-seasonal, bulk-update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, operation, data } = body;

    if (!propertyId || !operation || !data) {
      return NextResponse.json(
        { error: 'propertyId, operation, and data are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    switch (operation) {
      case 'apply-pattern':
        return await applyPattern(supabase, propertyId, data);

      case 'copy-rates':
        return await copyRates(supabase, propertyId, data);

      case 'copy-availability':
        return await copyAvailability(supabase, propertyId, data);

      case 'apply-seasonal':
        return await applySeasonal(supabase, propertyId, data);

      case 'bulk-update-restrictions':
        return await bulkUpdateRestrictions(supabase, propertyId, data);

      case 'fill-calendar':
        return await fillCalendar(supabase, propertyId, data);

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: 'Failed to execute bulk operation' },
      { status: 500 }
    );
  }
}

// Apply a recurring pattern to a date range
async function applyPattern(supabase: any, propertyId: string, data: any) {
  try {
    const { patternId, startDate, endDate, roomTypeId, roomId } = data;

    if (!patternId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'patternId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Fetch the pattern
    const { data: pattern, error: patternError } = await supabase
      .from('recurring_patterns')
      .select('*')
      .eq('id', patternId)
      .single();

    if (patternError || !pattern) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    // Generate dates array
    const dates = generateDateRange(new Date(startDate), new Date(endDate));

    // Filter by days of week if applicable (for weekly patterns)
    const applicableDates = pattern.days_of_week
      ? dates.filter((d: Date) => {
          const dayName = days[d.getDay()];
          return pattern.days_of_week.includes(dayName);
        })
      : dates;

    // Create availability entries based on pattern
    const availabilityData = applicableDates.map((date: Date) => {
      const dateStr = formatDate(date);
      const roomIdVal = roomTypeId || pattern.room_type_id;
      const roomTypeIdVal = roomId || pattern.room_id;
      const idParts = [propertyId, dateStr, roomIdVal || 'null', roomTypeIdVal || 'null'];
      const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

      return {
        id,
        property_id: propertyId,
        date: dateStr,
        status: 'available',
        min_nights: pattern.min_nights,
        max_nights: pattern.max_nights,
        occupancy: pattern.occupancy,
        room_type_id: roomTypeIdVal,
        room_id: roomIdVal,
        applied_at_level: roomId ? 'room' : (roomTypeId ? 'room_type' : 'property'),
      };
    });

    // Upsert availability
    const { data: result, error: upsertError } = await supabase
      .from('availability_calendar')
      .upsert(availabilityData)
      .select();

    if (upsertError) throw upsertError;

    return NextResponse.json(
      { message: `Pattern applied to ${result.length} dates`, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error applying pattern:', error);
    return NextResponse.json(
      { error: 'Failed to apply pattern' },
      { status: 500 }
    );
  }
}

// Copy rates from one period to another
async function copyRates(supabase: any, propertyId: string, data: any) {
  try {
    const { sourceStartDate, sourceEndDate, targetStartDate, ratePlanId, roomTypeId, roomId } = data;

    if (!sourceStartDate || !sourceEndDate || !targetStartDate || !ratePlanId) {
      return NextResponse.json(
        { error: 'sourceStartDate, sourceEndDate, targetStartDate, and ratePlanId are required' },
        { status: 400 }
      );
    }

    // Fetch source rates
    const { data: sourceRates, error: fetchError } = await supabase
      .from('daily_rates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('rate_plan_id', ratePlanId)
      .gte('date', sourceStartDate)
      .lte('date', sourceEndDate);

    if (fetchError) throw fetchError;

    if (!sourceRates || sourceRates.length === 0) {
      return NextResponse.json(
        { error: 'No rates found in source period' },
        { status: 404 }
      );
    }

    // Calculate day difference
    const sourceDiff = new Date(sourceEndDate).getTime() - new Date(sourceStartDate).getTime();
    const targetStart = new Date(targetStartDate);

    // Create target rates
    const targetRates = sourceRates.map((rate: any, index: number) => {
      const dayOffset = (index * (1000 * 60 * 60 * 24));
      const newDate = new Date(targetStart.getTime() + dayOffset);
      const dateStr = formatDate(newDate);
      const roomTypeIdVal = roomTypeId || rate.room_type_id;
      const roomIdVal = roomId || rate.room_id;
      const idParts = [propertyId, ratePlanId, dateStr, roomIdVal || 'null', roomTypeIdVal || 'null'];
      const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

      return {
        id,
        property_id: propertyId,
        rate_plan_id: ratePlanId,
        date: dateStr,
        base_price: rate.base_price,
        occupancy_price: rate.occupancy_price,
        room_type_id: roomTypeIdVal,
        room_id: roomIdVal,
        applied_at_level: rate.applied_at_level,
      };
    });

    // Upsert target rates
    const { data: result, error: upsertError } = await supabase
      .from('daily_rates')
      .upsert(targetRates)
      .select();

    if (upsertError) throw upsertError;

    return NextResponse.json(
      { message: `Rates copied to ${result.length} dates`, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error copying rates:', error);
    return NextResponse.json(
      { error: 'Failed to copy rates' },
      { status: 500 }
    );
  }
}

// Copy availability from one period to another
async function copyAvailability(supabase: any, propertyId: string, data: any) {
  try {
    const { sourceStartDate, sourceEndDate, targetStartDate, roomTypeId, roomId } = data;

    if (!sourceStartDate || !sourceEndDate || !targetStartDate) {
      return NextResponse.json(
        { error: 'sourceStartDate, sourceEndDate, and targetStartDate are required' },
        { status: 400 }
      );
    }

    // Fetch source availability
    const { data: sourceAvail, error: fetchError } = await supabase
      .from('availability_calendar')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', sourceStartDate)
      .lte('date', sourceEndDate);

    if (fetchError) throw fetchError;

    if (!sourceAvail || sourceAvail.length === 0) {
      return NextResponse.json(
        { error: 'No availability found in source period' },
        { status: 404 }
      );
    }

    // Create target availability
    const targetAvail = sourceAvail.map((avail: any, index: number) => {
      const dayOffset = (index * (1000 * 60 * 60 * 24));
      const newDate = new Date(new Date(targetStartDate).getTime() + dayOffset);
      const dateStr = formatDate(newDate);
      const roomTypeIdVal = roomTypeId || avail.room_type_id;
      const roomIdVal = roomId || avail.room_id;
      const idParts = [propertyId, dateStr, roomIdVal || 'null', roomTypeIdVal || 'null'];
      const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

      return {
        id,
        property_id: propertyId,
        date: dateStr,
        status: avail.status,
        min_nights: avail.min_nights,
        max_nights: avail.max_nights,
        occupancy: avail.occupancy,
        notes: avail.notes,
        room_type_id: roomTypeIdVal,
        room_id: roomIdVal,
        applied_at_level: avail.applied_at_level,
      };
    });

    // Upsert target availability
    const { data: result, error: upsertError } = await supabase
      .from('availability_calendar')
      .upsert(targetAvail)
      .select();

    if (upsertError) throw upsertError;

    return NextResponse.json(
      { message: `Availability copied to ${result.length} dates`, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error copying availability:', error);
    return NextResponse.json(
      { error: 'Failed to copy availability' },
      { status: 500 }
    );
  }
}

// Apply seasonal price modifier
async function applySeasonal(supabase: any, propertyId: string, data: any) {
  try {
    const { seasonId, ratePlanId } = data;

    if (!seasonId || !ratePlanId) {
      return NextResponse.json(
        { error: 'seasonId and ratePlanId are required' },
        { status: 400 }
      );
    }

    // Fetch season
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();

    if (seasonError || !season) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    // Fetch existing rates in season window
    const { data: existingRates, error: fetchError } = await supabase
      .from('daily_rates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('rate_plan_id', ratePlanId)
      .gte('date', season.season_start)
      .lte('date', season.season_end);

    if (fetchError) throw fetchError;

    if (!existingRates || existingRates.length === 0) {
      // Create new rates for all days in season
      const dates = generateDateRange(new Date(season.season_start), new Date(season.season_end));
      const newRates = dates.map((d: Date) => {
        const dateStr = formatDate(d);
        const idParts = [propertyId, ratePlanId, dateStr, 'null', 'null'];
        const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

        return {
          id,
          property_id: propertyId,
          rate_plan_id: ratePlanId,
          date: dateStr,
          base_price: 0, // Will need to be filled separately
          occupancy_price: 0,
          applied_at_level: 'property',
        };
      });

      const { data: result, error: createError } = await supabase
        .from('daily_rates')
        .insert(newRates)
        .select();

      if (createError) throw createError;

      return NextResponse.json(
        { message: `Created ${result.length} rates for season`, data: result },
        { status: 201 }
      );
    }

    // Update existing rates with seasonal modifier
    const updatedRates = existingRates.map((rate: any) => ({
      ...rate,
      base_price: Math.round(rate.base_price * (1 + season.price_modifier / 100)),
    }));

    const { data: result, error: updateError } = await supabase
      .from('daily_rates')
      .upsert(updatedRates)
      .select();

    if (updateError) throw updateError;

    return NextResponse.json(
      { message: `Updated ${result.length} rates with seasonal modifier`, data: result },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error applying seasonal pricing:', error);
    return NextResponse.json(
      { error: 'Failed to apply seasonal pricing' },
      { status: 500 }
    );
  }
}

// Bulk update restrictions
async function bulkUpdateRestrictions(supabase: any, propertyId: string, data: any) {
  try {
    const { restrictionIds, updates } = data;

    if (!restrictionIds || !Array.isArray(restrictionIds) || !updates) {
      return NextResponse.json(
        { error: 'restrictionIds array and updates are required' },
        { status: 400 }
      );
    }

    const { data: result, error } = await supabase
      .from('restrictions')
      .update(updates)
      .in('id', restrictionIds)
      .select();

    if (error) throw error;

    return NextResponse.json(
      { message: `Updated ${result.length} restrictions`, data: result },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error bulk updating restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update restrictions' },
      { status: 500 }
    );
  }
}

// Fill calendar with availability status for date range
async function fillCalendar(supabase: any, propertyId: string, data: any) {
  try {
    const { startDate, endDate, status, minNights, maxNights, roomTypeId, roomId } = data;

    if (!startDate || !endDate || !status) {
      return NextResponse.json(
        { error: 'startDate, endDate, and status are required' },
        { status: 400 }
      );
    }

    const dates = generateDateRange(new Date(startDate), new Date(endDate));

    const availabilityData = dates.map((date: Date) => {
      const dateStr = formatDate(date);
      const roomIdVal = roomId || null;
      const roomTypeIdVal = roomTypeId || null;
      const idParts = [propertyId, dateStr, roomIdVal || 'null', roomTypeIdVal || 'null'];
      const id = Buffer.from(idParts.join('|')).toString('base64').substring(0, 50);

      return {
        id,
        property_id: propertyId,
        date: dateStr,
        status,
        min_nights: minNights || 1,
        max_nights: maxNights || null,
        occupancy: 1,
        room_type_id: roomTypeIdVal,
        room_id: roomIdVal,
        applied_at_level: roomId ? 'room' : (roomTypeId ? 'room_type' : 'property'),
      };
    });

    const { data: result, error } = await supabase
      .from('availability_calendar')
      .upsert(availabilityData)
      .select();

    if (error) throw error;

    return NextResponse.json(
      { message: `Filled ${result.length} dates with status: ${status}`, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error filling calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fill calendar' },
      { status: 500 }
    );
  }
}

// Helper functions
const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function generateDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
