-- Create occupancy_restrictions table
CREATE TABLE IF NOT EXISTS occupancy_restrictions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_type_id UUID,
  room_id UUID,
  date DATE NOT NULL,
  min_occupancy INTEGER DEFAULT 1,
  max_occupancy INTEGER,
  applied_at_level VARCHAR(20) DEFAULT 'property', -- property, room_type, room
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT unique_occupancy UNIQUE (property_id, room_type_id, room_id, date)
);

CREATE INDEX IF NOT EXISTS idx_occupancy_property ON occupancy_restrictions(property_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_date ON occupancy_restrictions(property_id, date);
CREATE INDEX IF NOT EXISTS idx_occupancy_room_type ON occupancy_restrictions(property_id, room_type_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_room ON occupancy_restrictions(property_id, room_id);

-- Enable RLS
ALTER TABLE occupancy_restrictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "occupancy_select" ON occupancy_restrictions FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "occupancy_insert" ON occupancy_restrictions FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "occupancy_update" ON occupancy_restrictions FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "occupancy_delete" ON occupancy_restrictions FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
