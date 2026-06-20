-- Change property_id column type in availability_calendar from UUID to TEXT
-- This is needed because property IDs use text-based format

-- Drop RLS policies that depend on property_id
DROP POLICY IF EXISTS availability_select ON availability_calendar;
DROP POLICY IF EXISTS availability_insert ON availability_calendar;
DROP POLICY IF EXISTS availability_update ON availability_calendar;
DROP POLICY IF EXISTS availability_delete ON availability_calendar;

-- Change property_id column type from UUID to TEXT
ALTER TABLE availability_calendar
ALTER COLUMN property_id TYPE TEXT USING property_id::TEXT;

-- Recreate RLS policies with correct names
CREATE POLICY availability_select ON availability_calendar
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

CREATE POLICY availability_insert ON availability_calendar
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

CREATE POLICY availability_update ON availability_calendar
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

CREATE POLICY availability_delete ON availability_calendar
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

-- COMMENT explaining the change
COMMENT ON COLUMN availability_calendar.property_id IS 'Text ID referencing properties table. Properties use text-based IDs.';
