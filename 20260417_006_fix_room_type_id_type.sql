-- Migration: Fix room_type_id data type from UUID to TEXT
-- Purpose: The app uses TEXT-based room type IDs (like 'rt_1776276049268_hc20dd58j'), 
-- but the schema had room_type_id as UUID which causes "invalid input syntax for type uuid" errors
-- Date: 2026-04-17

-- Step 1: Drop the existing table (it's new, safe to drop)
DROP TABLE IF EXISTS availability_restrictions CASCADE;

-- Step 2: Recreate availability_restrictions with CORRECT data types
CREATE TABLE availability_restrictions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_id TEXT,
  room_type_id TEXT,  -- ✅ FIXED: Changed from UUID to TEXT
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

-- Step 3: Verify the table structure
-- Run this after migration to verify:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'availability_restrictions' ORDER BY ordinal_position;
