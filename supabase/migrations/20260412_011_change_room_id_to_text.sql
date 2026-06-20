-- Change room_id column type in availability_calendar from UUID to TEXT
-- This is needed because room IDs in the rooms table are non-UUID strings

-- Drop the UNIQUE constraint that uses room_id as UUID (if it exists)
DROP INDEX IF EXISTS unique_availability_per_scope;

-- Drop NOT NULL constraint if it exists (room_id is nullable for property/room-type level availability)
ALTER TABLE availability_calendar
ALTER COLUMN room_id DROP NOT NULL;

-- Change room_id column type from UUID to TEXT
-- The column is nullable (for property-level and room_type-level availability)
ALTER TABLE availability_calendar
ALTER COLUMN room_id TYPE TEXT USING room_id::TEXT;

-- Recreate the UNIQUE constraint without UUID casting
CREATE UNIQUE INDEX unique_availability_per_scope
  ON availability_calendar(date, COALESCE(room_id, room_type_id::TEXT, 'property'), property_id)
  WHERE room_id IS NOT NULL OR room_type_id IS NOT NULL;

-- COMMENT explaining the change
COMMENT ON COLUMN availability_calendar.room_id IS 'Text ID referencing rooms table. Rooms use text-based IDs (e.g., room_TIMESTAMP_RANDOM). Nullable for property-level and room-type-level availability.';
