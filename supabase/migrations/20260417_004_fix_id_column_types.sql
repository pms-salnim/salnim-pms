-- Migration: Fix ID column types in restrictions and rate_overrides tables
-- Purpose: Change id columns from UUID to TEXT to match API code that generates SHA-256 hash strings
-- Date: 2026-04-17

-- Drop the existing tables (they're new so safe to drop)
DROP TABLE IF EXISTS rate_overrides CASCADE;
DROP TABLE IF EXISTS availability_restrictions CASCADE;

-- Recreate availability_restrictions with TEXT id and room_id
CREATE TABLE availability_restrictions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_id TEXT,
  room_type_id UUID,
  date DATE NOT NULL,
  end_date DATE,
  min_nights INTEGER,
  max_nights INTEGER,
  close_to_arrival BOOLEAN DEFAULT false,
  close_to_departure BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_valid_date_range CHECK (end_date IS NULL OR end_date >= date),
  CONSTRAINT check_min_max_stay CHECK (min_nights IS NULL OR max_nights IS NULL OR min_nights <= max_nights),
  CONSTRAINT check_room_or_type CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL)
);

-- Add indexes for efficient querying
CREATE INDEX idx_availability_restrictions_property_date 
  ON availability_restrictions(property_id, date, end_date DESC);

CREATE INDEX idx_availability_restrictions_room 
  ON availability_restrictions(property_id, room_id, date) 
  WHERE room_id IS NOT NULL;

CREATE INDEX idx_availability_restrictions_room_type 
  ON availability_restrictions(property_id, room_type_id, date) 
  WHERE room_type_id IS NOT NULL;

-- Recreate rate_overrides with TEXT id and room_id
CREATE TABLE rate_overrides (
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
CREATE INDEX idx_rate_overrides_property_date 
  ON rate_overrides(property_id, date, end_date DESC);

CREATE INDEX idx_rate_overrides_room 
  ON rate_overrides(property_id, room_id, date);

CREATE INDEX idx_rate_overrides_rate_plan_ids 
  ON rate_overrides USING GIN (rate_plan_ids);
