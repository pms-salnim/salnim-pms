-- Optional: Create a view that expands availability ranges for easy querying
-- Use this if you need analytics or raw SQL reports that expect individual dates
-- WARNING: Large properties will create many rows. Use carefully with date filters.

CREATE OR REPLACE VIEW availability_calendar_expanded AS
SELECT 
  a.id,
  a.property_id,
  a.room_type_id,
  a.room_id,
  expanded_date AS date,  -- Individual date, not range
  a.status,
  a.min_nights,
  a.max_nights,
  a.occupancy,
  a.notes,
  a.applied_at_level,
  a.created_at,
  a.updated_at
FROM availability_calendar a
CROSS JOIN LATERAL generate_series(
  a.date,
  COALESCE(a.end_date, a.date + INTERVAL '9999 years'),
  INTERVAL '1 day'
) AS expanded_date
WHERE a.date <= CURRENT_DATE + INTERVAL '2 years'  -- Limit to next 2 years to avoid massive expansions
ORDER BY expanded_date, a.created_at DESC;

-- Index for the view (will help if querying)
-- Note: Can't index views directly, but the underlying table is already indexed

-- Example queries using the view:

-- Get all available rooms for a specific date:
-- SELECT * FROM availability_calendar_expanded 
-- WHERE property_id = 'prop-123' 
--   AND date = '2026-04-15' 
--   AND status = 'available'
--   AND room_id IS NOT NULL;

-- Count of available days per room:
-- SELECT 
--   room_id, 
--   COUNT(*) as available_days
-- FROM availability_calendar_expanded
-- WHERE property_id = 'prop-123'
--   AND status = 'available'
--   AND date >= CURRENT_DATE
-- GROUP BY room_id
-- ORDER BY available_days DESC;

-- Find gaps in availability (for problem detection):
-- SELECT 
--   property_id,
--   room_id,
--   date,
--   status,
--   LAG(status) OVER (PARTITION BY room_id ORDER BY date) as prev_status
-- FROM availability_calendar_expanded
-- WHERE property_id = 'prop-123'
--   AND status != 'available'
-- HAVING status != LAG(status) OVER (PARTITION BY room_id ORDER BY date)
-- ORDER BY date DESC;
