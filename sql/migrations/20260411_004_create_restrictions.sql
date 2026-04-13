-- Create restrictions table
CREATE TYPE restriction_type_enum AS ENUM (
  'min_nights',
  'max_nights',
  'advance_booking',
  'early_bird',
  'last_minute',
  'occupancy',
  'closed_period'
);

CREATE TABLE IF NOT EXISTS restrictions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  restriction_type restriction_type_enum NOT NULL,
  room_type_id UUID,
  room_id UUID,
  date_range_start DATE,
  date_range_end DATE,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sunday to 6=Saturday
  value INTEGER,
  discount_percentage DECIMAL(5, 2),
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_restrictions_property ON restrictions(property_id);
CREATE INDEX IF NOT EXISTS idx_restrictions_type ON restrictions(property_id, restriction_type);
CREATE INDEX IF NOT EXISTS idx_restrictions_status ON restrictions(property_id, status);
CREATE INDEX IF NOT EXISTS idx_restrictions_date_range ON restrictions(property_id, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_restrictions_room_type ON restrictions(property_id, room_type_id);

-- Enable RLS
ALTER TABLE restrictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "restrictions_select" ON restrictions FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "restrictions_insert" ON restrictions FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "restrictions_update" ON restrictions FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "restrictions_delete" ON restrictions FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
