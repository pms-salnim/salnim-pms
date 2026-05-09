-- Add applied_days JSONB column to availability tables for OTA sync and audit trail
-- This stores which days of week a rule applies to (0-6: Mon-Sun)

-- 1. Add applied_days to availability_calendar
ALTER TABLE availability_calendar 
ADD COLUMN IF NOT EXISTS applied_days JSONB DEFAULT NULL;

COMMENT ON COLUMN availability_calendar.applied_days IS 'Days of week this availability applies to (array of 0-6 where 0=Monday, 6=Sunday). NULL or empty means all days. E.g., [5,6] for Sa-Su.';

CREATE INDEX IF NOT EXISTS idx_availability_applied_days 
ON availability_calendar USING GIN (applied_days);

-- 2. Add applied_days to availability_restrictions table
ALTER TABLE availability_restrictions 
ADD COLUMN IF NOT EXISTS applied_days JSONB DEFAULT NULL;

COMMENT ON COLUMN availability_restrictions.applied_days IS 'Days of week this restriction applies to (array of 0-6). NULL means all days. This complements the existing days_of_week field for OTA sync compatibility.';

CREATE INDEX IF NOT EXISTS idx_restrictions_applied_days 
ON availability_restrictions USING GIN (applied_days);

-- 3. Add applied_days to rate_overrides
ALTER TABLE rate_overrides 
ADD COLUMN IF NOT EXISTS applied_days JSONB DEFAULT NULL;

COMMENT ON COLUMN rate_overrides.applied_days IS 'Days of week this rate override applies to (array of 0-6). NULL or empty means all days. E.g., [5,6] for weekends only.';

CREATE INDEX IF NOT EXISTS idx_rate_overrides_applied_days 
ON rate_overrides USING GIN (applied_days);

-- Create composite indexes for efficient filtering by date range + applied_days
CREATE INDEX IF NOT EXISTS idx_availability_date_and_days 
ON availability_calendar(property_id, date, end_date) 
WHERE applied_days IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restrictions_date_and_days 
ON availability_restrictions(property_id, date, end_date) 
WHERE applied_days IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_overrides_date_and_days 
ON rate_overrides(property_id, date, end_date) 
WHERE applied_days IS NOT NULL;
