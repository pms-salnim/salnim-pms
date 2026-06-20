-- Change room_type_id column type in availability_calendar from UUID to TEXT
-- This is needed because room type IDs in the room_types table are non-UUID strings

-- Drop the UNIQUE constraint that uses room_type_id as UUID (if it exists)
DROP INDEX IF EXISTS unique_availability_per_scope;

-- Drop NOT NULL constraint if it exists (room_type_id is nullable for property-level availability)
ALTER TABLE availability_calendar
ALTER COLUMN room_type_id DROP NOT NULL;

-- Change room_type_id column type from UUID to TEXT
ALTER TABLE availability_calendar
ALTER COLUMN room_type_id TYPE TEXT USING room_type_id::TEXT;

-- Recreate the UNIQUE constraint without UUID casting
CREATE UNIQUE INDEX unique_availability_per_scope
  ON availability_calendar(date, COALESCE(room_id, room_type_id, 'property'), property_id)
  WHERE room_id IS NOT NULL OR room_type_id IS NOT NULL;

-- COMMENT explaining the change
COMMENT ON COLUMN availability_calendar.room_type_id IS 'Text ID referencing room_types table. Room types use text-based IDs (e.g., rt_TIMESTAMP_RANDOM). Nullable for property-level availability.';
