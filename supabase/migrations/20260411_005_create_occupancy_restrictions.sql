-- Create occupancy_restrictions table
-- Stores minimum and maximum occupancy requirements per day
CREATE TABLE IF NOT EXISTS occupancy_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  min_occupancy INTEGER DEFAULT 1 CHECK (min_occupancy > 0),
  max_occupancy INTEGER CHECK (max_occupancy IS NULL OR max_occupancy > 0),
  applied_at_level TEXT NOT NULL CHECK (applied_at_level IN ('property', 'room_type', 'room')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_occupancy_range CHECK (max_occupancy IS NULL OR min_occupancy <= max_occupancy)
);

-- Indexes for common queries
CREATE INDEX idx_occupancy_restrictions_property_id ON occupancy_restrictions(property_id);
CREATE INDEX idx_occupancy_restrictions_room_type_id ON occupancy_restrictions(room_type_id);
CREATE INDEX idx_occupancy_restrictions_room_id ON occupancy_restrictions(room_id);
CREATE INDEX idx_occupancy_restrictions_date ON occupancy_restrictions(property_id, date);

-- UNIQUE constraint: One occupancy entry per day per scope
CREATE UNIQUE INDEX unique_occupancy_per_scope
  ON occupancy_restrictions(date, COALESCE(room_id, room_type_id, 'property'::uuid), property_id)
  WHERE room_id IS NOT NULL OR room_type_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE occupancy_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY occupancy_restrictions_select_policy ON occupancy_restrictions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = occupancy_restrictions.property_id
    )
  );

CREATE POLICY occupancy_restrictions_insert_policy ON occupancy_restrictions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = occupancy_restrictions.property_id
    )
  );

CREATE POLICY occupancy_restrictions_update_policy ON occupancy_restrictions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = occupancy_restrictions.property_id
    )
  );

CREATE POLICY occupancy_restrictions_delete_policy ON occupancy_restrictions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = occupancy_restrictions.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER occupancy_restrictions_update_timestamp
  BEFORE UPDATE ON occupancy_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
