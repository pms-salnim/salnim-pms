-- Migration: Create rate_overrides table
-- Purpose: Store rate overrides (percentage or fixed) for rooms on specific dates
-- Date: 2026-04-17

-- Create rate_overrides table
CREATE TABLE IF NOT EXISTS rate_overrides (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  override_type TEXT CHECK (override_type IN ('percentage', 'fixed')),
  override_value DECIMAL(10, 2),
  rate_plan_ids JSONB DEFAULT '[]'::jsonb,
  derive_pricing BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_valid_date_range CHECK (end_date IS NULL OR end_date >= date),
  CONSTRAINT check_override_type_and_value CHECK (
    (override_type IS NULL AND override_value IS NULL) OR
    (override_type IS NOT NULL AND override_value IS NOT NULL)
  )
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rate_overrides_property_date 
  ON rate_overrides(property_id, date, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_rate_overrides_room 
  ON rate_overrides(property_id, room_id, date);

CREATE INDEX IF NOT EXISTS idx_rate_overrides_rate_plan_ids 
  ON rate_overrides USING GIN (rate_plan_ids);

-- Add helpful comments
COMMENT ON TABLE rate_overrides IS 'Stores rate overrides (percentage or fixed amount) for specific rooms on specific dates';
COMMENT ON COLUMN rate_overrides.override_type IS 'Type of override: percentage (0-100) or fixed (absolute price)';
COMMENT ON COLUMN rate_overrides.override_value IS 'The override value: percentage as number or fixed price in currency';
COMMENT ON COLUMN rate_overrides.rate_plan_ids IS 'JSON array of rate plan IDs this override applies to';
COMMENT ON COLUMN rate_overrides.derive_pricing IS 'Whether to automatically derive pricing from parent rate plans';
