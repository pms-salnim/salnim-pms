-- Migration: Fix all data type issues in availability tables
-- Purpose: Change UUID columns to TEXT for property_id and room_id across all tables
-- This fixes "invalid input syntax for type uuid" errors when inserting string-based IDs
-- Date: 2026-04-17

-- Step 1: Drop old tables that have wrong data types (they're new, safe to drop)
DROP TABLE IF EXISTS rate_overrides CASCADE;
DROP TABLE IF EXISTS availability_restrictions CASCADE;

-- Step 2: Recreate availability_restrictions with correct types
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
  
  CONSTRAINT check_valid_date_range CHECK (end_date IS NULL OR end_date >= date),
  CONSTRAINT check_min_max_stay CHECK (min_nights IS NULL OR max_nights IS NULL OR min_nights <= max_nights),
  CONSTRAINT check_room_or_type CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL)
);

CREATE INDEX idx_availability_restrictions_property_date 
  ON availability_restrictions(property_id, date, end_date DESC);
CREATE INDEX idx_availability_restrictions_room 
  ON availability_restrictions(property_id, room_id, date) 
  WHERE room_id IS NOT NULL;
CREATE INDEX idx_availability_restrictions_room_type 
  ON availability_restrictions(property_id, room_type_id, date) 
  WHERE room_type_id IS NOT NULL;

-- Step 3: Recreate rate_overrides with correct types
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
  
  CONSTRAINT check_valid_date_range CHECK (end_date IS NULL OR end_date >= date),
  CONSTRAINT check_override_type_and_value CHECK (
    (override_type IS NULL AND override_value IS NULL) OR
    (override_type IS NOT NULL AND override_value IS NOT NULL)
  )
);

CREATE INDEX idx_rate_overrides_property_date 
  ON rate_overrides(property_id, date, end_date DESC);
CREATE INDEX idx_rate_overrides_room 
  ON rate_overrides(property_id, room_id, date);
CREATE INDEX idx_rate_overrides_rate_plan_ids 
  ON rate_overrides USING GIN (rate_plan_ids);
