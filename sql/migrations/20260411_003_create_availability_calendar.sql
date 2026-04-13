-- Create availability_calendar table
CREATE TYPE availability_status AS ENUM (
  'available',
  'not_available',
  'closed_to_arrival',
  'closed_to_departure',
  'on_request'
);

CREATE TABLE IF NOT EXISTS availability_calendar (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_type_id UUID,
  room_id UUID,
  date DATE NOT NULL,
  status availability_status DEFAULT 'available',
  min_nights INTEGER DEFAULT 1,
  max_nights INTEGER,
  occupancy INTEGER,
  notes TEXT,
  applied_at_level VARCHAR(20) DEFAULT 'property', -- property, room_type, room
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT unique_availability UNIQUE (property_id, room_type_id, room_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_property ON availability_calendar(property_id);
CREATE INDEX IF NOT EXISTS idx_availability_date_range ON availability_calendar(property_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_status ON availability_calendar(property_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_room_type ON availability_calendar(property_id, room_type_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_room ON availability_calendar(property_id, room_id, date);

-- Enable RLS
ALTER TABLE availability_calendar ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "availability_select" ON availability_calendar FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "availability_insert" ON availability_calendar FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "availability_update" ON availability_calendar FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "availability_delete" ON availability_calendar FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
