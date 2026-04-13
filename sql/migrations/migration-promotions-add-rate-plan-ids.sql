-- Migration: Add rate_plan_ids column to promotions table
-- Date: 2026-04-08
-- Purpose: Support targeting promotions to specific rate plans

-- Add rate_plan_ids column to promotions table
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS rate_plan_ids JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN promotions.rate_plan_ids IS 'Array of rate plan IDs this promotion applies to. Empty array means applies to all rate plans.';

-- Create index on rate_plan_ids for faster queries
CREATE INDEX IF NOT EXISTS idx_promotions_rate_plan_ids ON promotions USING GIN (rate_plan_ids);
