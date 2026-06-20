-- Migration: Add occupancy fields to room_types table
-- Date: April 26, 2026
-- Description: Adds max_adults, max_children, adults_included_in_base_rate, and children_included_in_base_rate columns to room_types table

-- Add new columns to room_types table
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_adults INTEGER;
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_children INTEGER;
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS adults_included_in_base_rate INTEGER;
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS children_included_in_base_rate INTEGER;

-- Add comments to the columns
COMMENT ON COLUMN room_types.max_adults IS 'Maximum number of adults allowed in this room type (optional)';
COMMENT ON COLUMN room_types.max_children IS 'Maximum number of children allowed in this room type (optional)';
COMMENT ON COLUMN room_types.adults_included_in_base_rate IS 'Number of adults included in the base rate pricing';
COMMENT ON COLUMN room_types.children_included_in_base_rate IS 'Number of children included in the base rate pricing';
