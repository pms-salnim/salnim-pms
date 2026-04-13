-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  season_start DATE NOT NULL,
  season_end DATE NOT NULL,
  price_modifier DECIMAL(5, 2) NOT NULL, -- percentage modifier (e.g., 50 for +50%, -30 for -30%)
  color VARCHAR(7) DEFAULT '#3B82F6', -- HEX color code
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT unique_season_name UNIQUE (property_id, name),
  CONSTRAINT check_season_dates CHECK (season_start <= season_end)
);

CREATE INDEX IF NOT EXISTS idx_seasons_property ON seasons(property_id);
CREATE INDEX IF NOT EXISTS idx_seasons_date_range ON seasons(property_id, season_start, season_end);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(property_id, status);

-- Enable RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "seasons_select" ON seasons FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "seasons_insert" ON seasons FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "seasons_update" ON seasons FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "seasons_delete" ON seasons FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
