-- Migration: Add room_type_ids to promotions table
-- Date: 2026-04-08
-- Purpose: Support discount application to specific room types

ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS room_type_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update existing records to have empty array if null
UPDATE promotions SET room_type_ids = ARRAY[]::TEXT[] WHERE room_type_ids IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE promotions
ALTER COLUMN room_type_ids SET NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_promotions_room_type_ids ON promotions USING GIN (room_type_ids);
