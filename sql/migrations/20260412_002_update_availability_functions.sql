-- Update stored procedures to handle range-based availability
-- This migration updates functions that query availability_calendar to properly
-- handle the new end_date column for range-based storage

CREATE OR REPLACE FUNCTION get_availability_for_date(
  p_property_id TEXT,
  p_room_type_id UUID,
  p_room_id UUID,
  p_date DATE
)
RETURNS TABLE (id TEXT, status VARCHAR, min_nights INTEGER, max_nights INTEGER) AS $$
BEGIN
  -- Try room-level availability first
  RETURN QUERY
  SELECT a.id, a.status, a.min_nights, a.max_nights
  FROM availability_calendar a
  WHERE a.property_id = p_property_id
    AND a.room_id = p_room_id
    AND a.date <= p_date 
    AND (a.end_date >= p_date OR a.end_date IS NULL)
  ORDER BY a.date DESC
  LIMIT 1;

  -- If not found, try room_type level
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT a.id, a.status, a.min_nights, a.max_nights
    FROM availability_calendar a
    WHERE a.property_id = p_property_id
      AND a.room_type_id = p_room_type_id
      AND a.room_id IS NULL
      AND a.date <= p_date 
      AND (a.end_date >= p_date OR a.end_date IS NULL)
    ORDER BY a.date DESC
    LIMIT 1;
  END IF;

  -- If not found, try property level
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT a.id, a.status, a.min_nights, a.max_nights
    FROM availability_calendar a
    WHERE a.property_id = p_property_id
      AND a.room_type_id IS NULL
      AND a.room_id IS NULL
      AND a.date <= p_date 
      AND (a.end_date >= p_date OR a.end_date IS NULL)
    ORDER BY a.date DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a room is available for a date range
CREATE OR REPLACE FUNCTION is_room_available_for_range(
  p_property_id TEXT,
  p_room_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  -- A room is available if there are NO blocking records in the date range
  -- Blocking statuses: 'not_available', 'blocked', 'closed_to_arrival', 'closed_to_departure'
  
  RETURN NOT EXISTS (
    SELECT 1
    FROM availability_calendar a
    WHERE a.property_id = p_property_id
      AND a.room_id = p_room_id
      AND a.status IN ('not_available', 'blocked', 'closed_to_arrival', 'closed_to_departure')
      AND a.date <= p_end_date
      AND (a.end_date >= p_start_date OR a.end_date IS NULL)
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get blocked dates in a range
CREATE OR REPLACE FUNCTION get_blocked_dates_in_range(
  p_property_id TEXT,
  p_room_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (blocked_date DATE, status VARCHAR, reason TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    blocked_date,
    a.status::VARCHAR,
    a.notes as reason
  FROM availability_calendar a
  CROSS JOIN LATERAL generate_series(
    GREATEST(a.date, p_start_date),
    LEAST(COALESCE(a.end_date, p_end_date), p_end_date),
    INTERVAL '1 day'
  )::DATE as blocked_date
  WHERE a.property_id = p_property_id
    AND a.room_id = p_room_id
    AND a.status IN ('not_available', 'blocked', 'closed_to_arrival', 'closed_to_departure')
    AND a.date <= p_end_date
    AND (a.end_date >= p_start_date OR a.end_date IS NULL)
  ORDER BY blocked_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get minimum stay for a specific date
CREATE OR REPLACE FUNCTION get_min_stay_for_date(
  p_property_id TEXT,
  p_room_id UUID,
  p_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_min_nights INTEGER;
BEGIN
  -- Get the most specific match (room > room_type > property)
  SELECT COALESCE(a.min_nights, 1)
  INTO v_min_nights
  FROM availability_calendar a
  WHERE a.property_id = p_property_id
    AND a.room_id = p_room_id
    AND a.date <= p_date
    AND (a.end_date >= p_date OR a.end_date IS NULL)
  ORDER BY a.date DESC
  LIMIT 1;

  IF v_min_nights IS NOT NULL THEN
    RETURN v_min_nights;
  END IF;

  -- Fall back to room_type level
  SELECT COALESCE(a.min_nights, 1)
  INTO v_min_nights
  FROM availability_calendar a
  WHERE a.property_id = p_property_id
    AND a.room_type_id IS NOT NULL
    AND a.room_id IS NULL
    AND a.date <= p_date
    AND (a.end_date >= p_date OR a.end_date IS NULL)
  ORDER BY a.date DESC
  LIMIT 1;

  IF v_min_nights IS NOT NULL THEN
    RETURN v_min_nights;
  END IF;

  -- Fall back to property level
  SELECT COALESCE(a.min_nights, 1)
  INTO v_min_nights
  FROM availability_calendar a
  WHERE a.property_id = p_property_id
    AND a.room_type_id IS NULL
    AND a.room_id IS NULL
    AND a.date <= p_date
    AND (a.end_date >= p_date OR a.end_date IS NULL)
  ORDER BY a.date DESC
  LIMIT 1;

  RETURN COALESCE(v_min_nights, 1);
END;
$$ LANGUAGE plpgsql;
