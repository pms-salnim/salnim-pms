import { createClient } from '@supabase/supabase-js';
import { eachDayOfInterval, addDays, startOfDay } from 'date-fns';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Check if a room is available in Supabase availability_calendar for all dates in the range.
 * A room is considered available if it has at least one 'available' status record for each date.
 * 
 * @param roomId - The room ID to check
 * @param propertyId - The property ID
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (exclusive, like check-out date)
 * @returns true if room is available for all dates in range, false otherwise
 */
export async function isRoomAvailableInSupabase(
  roomId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  try {
    // Get all dates in the range
    const datesInRange = eachDayOfInterval({
      start: startOfDay(startDate),
      end: addDays(startOfDay(endDate), -1),
    });

    if (datesInRange.length === 0) {
      return false;
    }

    // Convert to YYYY-MM-DD format strings
    const dateStrings = datesInRange.map(date => date.toISOString().split('T')[0]);

    // Query Supabase for availability records for these dates
    const { data, error } = await supabase
      .from('availability_calendar')
      .select('date, status')
      .eq('property_id', propertyId)
      .eq('room_id', roomId)
      .in('date', dateStrings);

    if (error) {
      console.error('Supabase availability check error:', error);
      // If there's an error querying, we must be conservative and deny access
      return false;
    }

    if (!data || data.length === 0) {
      // No availability records found - room is not explicitly available
      return false;
    }

    // Check that we have 'available' status for ALL dates
    const availableDates = new Set(
      data
        .filter(record => record.status === 'available')
        .map(record => record.date)
    );

    // All dates must have at least one record with 'available' status
    const allDatesAvailable = dateStrings.every(dateStr => availableDates.has(dateStr));

    return allDatesAvailable;
  } catch (error) {
    console.error('Error checking Supabase availability:', error);
    // Default to deny on error for safety
    return false;
  }
}

/**
 * Check if multiple rooms are all available for a date range.
 * 
 * @param roomIds - Array of room IDs to check
 * @param propertyId - The property ID
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (exclusive)
 * @returns Object with room IDs mapped to availability boolean
 */
export async function checkMultipleRoomsAvailability(
  roomIds: string[],
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const roomId of roomIds) {
    results[roomId] = await isRoomAvailableInSupabase(roomId, propertyId, startDate, endDate);
  }

  return results;
}
