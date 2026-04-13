-- Create restrictions table
-- Stores business rules: min/max nights, advance booking, early bird, last-minute discounts
CREATE TABLE IF NOT EXISTS restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  restriction_type TEXT NOT NULL CHECK (
    restriction_type IN (
      'min_nights',
      'max_nights',
      'advance_booking',
      'early_bird',
      'last_minute',
      'occupancy',
      'closed_period'
    )
  ),
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date_range_start DATE,
  date_range_end DATE,
  days_of_week TEXT[], -- ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  value INTEGER, -- nights for min/max, days for advance booking
  discount_percentage DECIMAL(5, 2) CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  applied_at_level TEXT NOT NULL CHECK (applied_at_level IN ('property', 'room_type', 'room')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_dates CHECK (date_range_start IS NULL OR date_range_end IS NULL OR date_range_start <= date_range_end)
);

-- Indexes for common queries
CREATE INDEX idx_restrictions_property_id ON restrictions(property_id);
CREATE INDEX idx_restrictions_room_type_id ON restrictions(room_type_id);
CREATE INDEX idx_restrictions_room_id ON restrictions(room_id);
CREATE INDEX idx_restrictions_type ON restrictions(restriction_type);
CREATE INDEX idx_restrictions_status ON restrictions(property_id, status);
CREATE INDEX idx_restrictions_date_range ON restrictions(property_id, date_range_start, date_range_end);
CREATE INDEX idx_restrictions_active ON restrictions(property_id) WHERE status = 'active';

-- Enable Row Level Security
ALTER TABLE restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY restrictions_select_policy ON restrictions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = restrictions.property_id
    )
  );

CREATE POLICY restrictions_insert_policy ON restrictions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = restrictions.property_id
    )
  );

CREATE POLICY restrictions_update_policy ON restrictions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = restrictions.property_id
    )
  );

CREATE POLICY restrictions_delete_policy ON restrictions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = restrictions.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER restrictions_update_timestamp
  BEFORE UPDATE ON restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
