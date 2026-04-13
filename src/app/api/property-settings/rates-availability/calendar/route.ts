import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface AvailabilityRecord {
  room_id: string;
  date: string;
  end_date: string | null;
  status: string;
}

interface ExpandedAvailability {
  room_id: string;
  date: string;
  end_date: string | null;
  status: string;
}

/**
 * GET /api/property-settings/rates-availability/calendar
 * Fetches availability data for calendar display
 * Expands date ranges to include all dates
 * 
 * Query Parameters:
 * - propertyId (required): Property ID
 * - minDate (required): Start date (YYYY-MM-DD)
 * - maxDate (required): End date (YYYY-MM-DD)
 * - roomIds (optional): Comma-separated room IDs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const minDate = searchParams.get('minDate');
    const maxDate = searchParams.get('maxDate');
    const roomIdsParam = searchParams.get('roomIds');

    if (!propertyId || !minDate || !maxDate) {
      return NextResponse.json(
        { error: 'propertyId, minDate, and maxDate are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Parse room IDs if provided
    const roomIds = roomIdsParam ? roomIdsParam.split(',') : [];

    // Build query
    let query = supabase
      .from('availability_calendar')
      .select('room_id, date, end_date, status')
      .eq('property_id', propertyId)
      .lte('date', maxDate);  // date <= maxDate

    // Filter by room IDs if provided
    if (roomIds.length > 0) {
      query = query.in('room_id', roomIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter client-side for proper date range handling
    // Keep records where: date <= maxDate AND (end_date IS NULL OR end_date >= minDate)
    const recordsInRange = (data ?? []).filter(record => {
      const recordDate = record.date;
      const recordEndDate = record.end_date;

      // Record must start before or on maxDate
      if (recordDate > maxDate) return false;

      // Record must end after or on minDate (or be open-ended)
      if (recordEndDate && recordEndDate < minDate) return false;

      return true;
    });

    // Expand date ranges to individual dates
    const expandedData: ExpandedAvailability[] = [];
    const queryMinDate = new Date(minDate);
    const queryMaxDate = new Date(maxDate);

    recordsInRange.forEach(record => {
      const startDate = new Date(record.date);
      const endDate = record.end_date ? new Date(record.end_date) : new Date(queryMaxDate);

      // Clamp to query range
      if (startDate < queryMinDate) startDate.setTime(queryMinDate.getTime());
      if (endDate > queryMaxDate) endDate.setTime(queryMaxDate.getTime());

      // Add entry for each date in the range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        expandedData.push({
          room_id: record.room_id,
          date: dateStr,
          end_date: record.end_date,
          status: record.status,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return NextResponse.json(expandedData);
  } catch (error) {
    console.error('Error fetching calendar availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
