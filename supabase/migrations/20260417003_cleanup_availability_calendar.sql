-- Migration: Clean up availability_calendar table
-- Purpose: Remove rate override and restriction columns (now in separate tables)
-- Date: 2026-04-17

-- Drop columns that are now in separate tables
ALTER TABLE availability_calendar
DROP COLUMN IF EXISTS override_type,
DROP COLUMN IF EXISTS override_value,
DROP COLUMN IF EXISTS derive_pricing,
DROP COLUMN IF EXISTS rate_plan_ids;

-- Add helpful comment
COMMENT ON TABLE availability_calendar IS 'Core availability calendar table - stores only availability status (available, not_available, closed_to_arrival, closed_to_departure). Restrictions and rates are stored in separate tables and joined via property_id, room_id, date.';
