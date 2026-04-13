-- Create recurring_patterns table
-- Stores weekly and seasonal patterns that repeat automatically
CREATE TABLE IF NOT EXISTS recurring_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('weekly', 'seasonal', 'custom')),
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  days_of_week TEXT[], -- ['SAT', 'SUN', 'MON'] for weekly patterns
  min_nights INTEGER CHECK (min_nights IS NULL OR min_nights > 0),
  max_nights INTEGER CHECK (max_nights IS NULL OR max_nights > 0),
  occupancy INTEGER CHECK (occupancy IS NULL OR occupancy > 0),
  price_modifier DECIMAL(5, 2), -- % adjustment (e.g., 150 = 150%, -20 = -20%)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  applied_at_level TEXT NOT NULL CHECK (applied_at_level IN ('property', 'room_type', 'room')),
  start_date DATE, -- For seasonal patterns
  end_date DATE, -- For seasonal patterns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
  CONSTRAINT unique_pattern_name UNIQUE(property_id, name)
);

-- Indexes for common queries
CREATE INDEX idx_recurring_patterns_property_id ON recurring_patterns(property_id);
CREATE INDEX idx_recurring_patterns_room_type_id ON recurring_patterns(room_type_id);
CREATE INDEX idx_recurring_patterns_room_id ON recurring_patterns(room_id);
CREATE INDEX idx_recurring_patterns_status ON recurring_patterns(property_id, status);
CREATE INDEX idx_recurring_patterns_active ON recurring_patterns(property_id) WHERE status = 'active';

-- Enable Row Level Security
ALTER TABLE recurring_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_patterns_select_policy ON recurring_patterns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = recurring_patterns.property_id
    )
  );

CREATE POLICY recurring_patterns_insert_policy ON recurring_patterns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = recurring_patterns.property_id
    )
  );

CREATE POLICY recurring_patterns_update_policy ON recurring_patterns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = recurring_patterns.property_id
    )
  );

CREATE POLICY recurring_patterns_delete_policy ON recurring_patterns
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = recurring_patterns.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER recurring_patterns_update_timestamp
  BEFORE UPDATE ON recurring_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
