-- Create daily_rates table
-- Stores granular day-by-day pricing for rate plans
CREATE TABLE IF NOT EXISTS daily_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rate_plan_id UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  occupancy_price DECIMAL(10, 2) DEFAULT 0, -- Price per extra guest
  applied_at_level TEXT NOT NULL CHECK (applied_at_level IN ('property', 'room_type', 'room')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_price_positive CHECK (base_price >= 0 AND occupancy_price >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_daily_rates_property_id ON daily_rates(property_id);
CREATE INDEX idx_daily_rates_rate_plan_id ON daily_rates(rate_plan_id);
CREATE INDEX idx_daily_rates_room_type_id ON daily_rates(room_type_id);
CREATE INDEX idx_daily_rates_room_id ON daily_rates(room_id);
CREATE INDEX idx_daily_rates_date_range ON daily_rates(property_id, date);
CREATE INDEX idx_daily_rates_level_lookup ON daily_rates(property_id, date, room_id, rate_plan_id);

-- UNIQUE constraint: One rate per day, per room (or room_type, or property level)
-- When room_id is NULL, it's room_type level; when both are NULL, it's property level
CREATE UNIQUE INDEX unique_daily_rate_scope
  ON daily_rates(date, COALESCE(room_id, room_type_id, 'property'::uuid), rate_plan_id, property_id)
  WHERE room_id IS NOT NULL OR room_type_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE daily_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_rates_select_policy ON daily_rates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = daily_rates.property_id
    )
  );

CREATE POLICY daily_rates_insert_policy ON daily_rates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = daily_rates.property_id
    )
  );

CREATE POLICY daily_rates_update_policy ON daily_rates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = daily_rates.property_id
    )
  );

CREATE POLICY daily_rates_delete_policy ON daily_rates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = daily_rates.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER daily_rates_update_timestamp
  BEFORE UPDATE ON daily_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
