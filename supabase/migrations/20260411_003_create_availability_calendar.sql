-- Create availability_calendar table
-- Core table: Stores availability status (available, not_available, closed_to_arrival, etc.) per day
CREATE TABLE IF NOT EXISTS availability_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'not_available', 'closed_to_arrival', 'closed_to_departure', 'on_request')),
  applied_at_level TEXT NOT NULL CHECK (applied_at_level IN ('property', 'room_type', 'room')),
  min_nights INTEGER DEFAULT 1 CHECK (min_nights > 0),
  max_nights INTEGER CHECK (max_nights IS NULL OR max_nights > 0),
  occupancy INTEGER DEFAULT 1 CHECK (occupancy > 0), -- Minimum occupancy required
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_availability_calendar_property_id ON availability_calendar(property_id);
CREATE INDEX idx_availability_calendar_room_type_id ON availability_calendar(room_type_id);
CREATE INDEX idx_availability_calendar_room_id ON availability_calendar(room_id);
CREATE INDEX idx_availability_calendar_date_range ON availability_calendar(property_id, date);
CREATE INDEX idx_availability_calendar_status ON availability_calendar(property_id, status);

-- UNIQUE constraint: One availability entry per day per scope
CREATE UNIQUE INDEX unique_availability_per_scope
  ON availability_calendar(date, COALESCE(room_id, room_type_id, 'property'::uuid), property_id)
  WHERE room_id IS NOT NULL OR room_type_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE availability_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY availability_calendar_select_policy ON availability_calendar
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

CREATE POLICY availability_calendar_insert_policy ON availability_calendar
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

CREATE POLICY availability_calendar_update_policy ON availability_calendar
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

CREATE POLICY availability_calendar_delete_policy ON availability_calendar
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = availability_calendar.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER availability_calendar_update_timestamp
  BEFORE UPDATE ON availability_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
