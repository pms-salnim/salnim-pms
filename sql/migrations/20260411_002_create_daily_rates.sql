-- Create daily_rates table
CREATE TABLE IF NOT EXISTS daily_rates (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  rate_plan_id TEXT NOT NULL,
  room_type_id UUID,
  room_id UUID,
  date DATE NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  occupancy_price DECIMAL(10, 2),
  applied_at_level VARCHAR(20) DEFAULT 'property', -- property, room_type, room
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT fk_rate_plan FOREIGN KEY (rate_plan_id) REFERENCES rate_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_rates_property ON daily_rates(property_id);
CREATE INDEX IF NOT EXISTS idx_daily_rates_date_range ON daily_rates(property_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_rates_room_type ON daily_rates(property_id, room_type_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_rates_room ON daily_rates(property_id, room_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_rates_rate_plan ON daily_rates(rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_daily_rates_applied_level ON daily_rates(applied_at_level);

-- Enable RLS
ALTER TABLE daily_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "daily_rates_select" ON daily_rates FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "daily_rates_insert" ON daily_rates FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "daily_rates_update" ON daily_rates FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "daily_rates_delete" ON daily_rates FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
