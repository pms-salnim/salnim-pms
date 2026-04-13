-- Create seasons table
-- Stores named seasons for easy management of seasonal pricing and restrictions
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  season_start DATE NOT NULL,
  season_end DATE NOT NULL,
  price_modifier DECIMAL(5, 2) CHECK (price_modifier NOT NULL), -- % adjustment (e.g., 150 = 150% of base)
  color HEX,  -- Visual indicator hex color (e.g., '#FF6B6B' for red)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_season_dates CHECK (season_start <= season_end),
  CONSTRAINT unique_season_name UNIQUE(property_id, name)
);

-- Indexes for common queries
CREATE INDEX idx_seasons_property_id ON seasons(property_id);
CREATE INDEX idx_seasons_status ON seasons(property_id, status);
CREATE INDEX idx_seasons_date_range ON seasons(property_id, season_start, season_end);
CREATE INDEX idx_seasons_active ON seasons(property_id) WHERE status = 'active';

-- Enable Row Level Security
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY seasons_select_policy ON seasons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = seasons.property_id
    )
  );

CREATE POLICY seasons_insert_policy ON seasons
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = seasons.property_id
    )
  );

CREATE POLICY seasons_update_policy ON seasons
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = seasons.property_id
    )
  );

CREATE POLICY seasons_delete_policy ON seasons
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = seasons.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER seasons_update_timestamp
  BEFORE UPDATE ON seasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
