-- Create rate_plans table
-- Stores different pricing strategies like "Standard", "Member", "Non-cancellable"
CREATE TABLE IF NOT EXISTS rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  cancellation_policy TEXT CHECK (cancellation_policy IN ('strict', 'moderate', 'flexible')),
  free_cancellation_until TIMESTAMP WITH TIME ZONE,
  non_refundable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_rate_plan_name_per_property UNIQUE(property_id, name)
);

-- Indexes for common queries
CREATE INDEX idx_rate_plans_property_id ON rate_plans(property_id);
CREATE INDEX idx_rate_plans_is_default ON rate_plans(property_id, is_default);

-- Enable Row Level Security
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own property's rate plans
CREATE POLICY rate_plans_select_policy ON rate_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rate_plans.property_id
    )
  );

CREATE POLICY rate_plans_insert_policy ON rate_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rate_plans.property_id
    )
  );

CREATE POLICY rate_plans_update_policy ON rate_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rate_plans.property_id
    )
  );

CREATE POLICY rate_plans_delete_policy ON rate_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rate_plans.property_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER rate_plans_update_timestamp
  BEFORE UPDATE ON rate_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
