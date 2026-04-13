-- Create recurring_patterns table
CREATE TYPE pattern_type_enum AS ENUM (
  'weekly',
  'seasonal',
  'custom'
);

CREATE TABLE IF NOT EXISTS recurring_patterns (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  pattern_type pattern_type_enum DEFAULT 'weekly',
  room_type_id UUID,
  room_id UUID,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sunday to 6=Saturday
  min_nights INTEGER,
  max_nights INTEGER,
  occupancy INTEGER,
  price_modifier DECIMAL(5, 2), -- percentage modifier
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT unique_pattern_name UNIQUE (property_id, name)
);

CREATE INDEX IF NOT EXISTS idx_patterns_property ON recurring_patterns(property_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON recurring_patterns(property_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON recurring_patterns(property_id, status);
CREATE INDEX IF NOT EXISTS idx_patterns_date_range ON recurring_patterns(property_id, start_date, end_date);

-- Enable RLS
ALTER TABLE recurring_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "patterns_select" ON recurring_patterns FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "patterns_insert" ON recurring_patterns FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "patterns_update" ON recurring_patterns FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "patterns_delete" ON recurring_patterns FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
