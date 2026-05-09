-- Migration: Add rate override columns to availability_calendar table
-- Purpose: Support seasonal rate overrides (percentage and fixed price) alongside restrictions
-- Date: 2026-04-16

-- Add columns to track rate override type and value
ALTER TABLE availability_calendar
ADD COLUMN IF NOT EXISTS override_type TEXT CHECK (override_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS override_value DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add helpful comments
COMMENT ON COLUMN availability_calendar.override_type IS 'Type of rate override: percentage (e.g., 20 = +20%), fixed (e.g., $150/night), or NULL for no override';
COMMENT ON COLUMN availability_calendar.override_value IS 'Numeric value of override: percentage points (0-100+) or fixed price amount (in cents/2 decimals)';
COMMENT ON COLUMN availability_calendar.end_date IS 'End date for date range overrides (e.g., peak season from date to end_date)';

-- Add constraint that end_date >= date (wrapped in DO block to handle if it already exists)
DO $$
BEGIN
  BEGIN
    ALTER TABLE availability_calendar
    ADD CONSTRAINT check_end_date_after_start 
      CHECK (end_date IS NULL OR end_date >= date);
  EXCEPTION WHEN duplicate_object THEN
    NULL;  -- Constraint already exists, ignore
  END;
END $$;

-- Add index for efficient queries on date ranges with rate overrides
CREATE INDEX IF NOT EXISTS idx_availability_override_type 
  ON availability_calendar(property_id, date, override_type);

-- Create index for date range queries (with end_date)
CREATE INDEX IF NOT EXISTS idx_availability_date_range_with_end_date 
  ON availability_calendar(property_id, date, COALESCE(end_date, date));

