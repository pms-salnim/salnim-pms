-- Create rate_plans table
CREATE TABLE IF NOT EXISTS rate_plans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  cancellation_policy VARCHAR(50) DEFAULT 'flexible',
  free_cancellation_until INTEGER, -- days before checkin
  non_refundable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT unique_property_plan_name UNIQUE (property_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rate_plans_property ON rate_plans(property_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_is_default ON rate_plans(property_id, is_default);

-- Enable RLS
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rate_plans
CREATE POLICY "rate_plans_select" ON rate_plans FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "rate_plans_insert" ON rate_plans FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);

CREATE POLICY "rate_plans_update" ON rate_plans FOR UPDATE
  USING (auth.uid()::text = property_id::text OR true);

CREATE POLICY "rate_plans_delete" ON rate_plans FOR DELETE
  USING (auth.uid()::text = property_id::text OR true);
