-- Migration: Create availability_restrictions table
-- Purpose: Store room-level and room-type-level restrictions (min/max stay, CTA, CTD)
-- Date: 2026-04-17

-- Create availability_restrictions table
CREATE TABLE IF NOT EXISTS availability_restrictions (
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
CREATE INDEX IF NOT EXISTS idx_availability_restrictions_property_date 
  ON availability_restrictions(property_id, date, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_availability_restrictions_room 
  ON availability_restrictions(property_id, room_id, date) 
  WHERE room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_availability_restrictions_room_type 
  ON availability_restrictions(property_id, room_type_id, date) 
  WHERE room_type_id IS NOT NULL;

-- Add helpful comments
COMMENT ON TABLE availability_restrictions IS 'Stores min/max stay restrictions, close-to-arrival, and close-to-departure rules for rooms or room types';
COMMENT ON COLUMN availability_restrictions.min_nights IS 'Minimum number of nights for booking start on this date';
COMMENT ON COLUMN availability_restrictions.max_nights IS 'Maximum number of nights for booking start on this date';
COMMENT ON COLUMN availability_restrictions.close_to_arrival IS 'If true, room cannot be booked for arrival on this date';
COMMENT ON COLUMN availability_restrictions.close_to_departure IS 'If true, room cannot be booked for departure on this date';
