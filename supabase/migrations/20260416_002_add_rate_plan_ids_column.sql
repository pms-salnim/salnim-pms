-- Migration: Add rate_plan_ids column to availability_calendar table
-- Purpose: Track which rate plans are associated with rate overrides
-- Date: 2026-04-16

-- Add rate_plan_ids column to store array of rate plan UUIDs
ALTER TABLE availability_calendar
ADD COLUMN IF NOT EXISTS rate_plan_ids JSONB DEFAULT '[]'::jsonb;

-- Add helpful comment
COMMENT ON COLUMN availability_calendar.rate_plan_ids IS 'JSON array of rate plan IDs that this override applies to';

-- Add index for efficient queries using rate plan IDs
CREATE INDEX IF NOT EXISTS idx_availability_rate_plan_ids 
  ON availability_calendar USING GIN (rate_plan_ids);

-- Add derive_pricing column if it doesn't exist
ALTER TABLE availability_calendar
ADD COLUMN IF NOT EXISTS derive_pricing BOOLEAN DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN availability_calendar.derive_pricing IS 'Whether to automatically derive pricing based on parent rates';
