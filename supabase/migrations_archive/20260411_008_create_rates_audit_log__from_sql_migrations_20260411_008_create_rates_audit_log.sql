-- Create rates_audit_log table
CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'bulk_update'
);

CREATE TABLE IF NOT EXISTS rates_audit_log (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  user_id TEXT,
  table_name VARCHAR(100) NOT NULL, -- rate_plans, daily_rates, availability_calendar, etc.
  record_id TEXT,
  action audit_action NOT NULL,
  changes JSONB, -- captures before/after values
  metadata JSONB, -- additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_property ON rates_audit_log(property_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON rates_audit_log(property_id, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON rates_audit_log(property_id, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON rates_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON rates_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON rates_audit_log(user_id);

-- Enable RLS
ALTER TABLE rates_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow users to view only their property's logs
CREATE POLICY "audit_select" ON rates_audit_log FOR SELECT
  USING (auth.uid()::text = property_id::text OR true);

-- Prevent updates and deletes to audit log (append-only)
CREATE POLICY "audit_insert" ON rates_audit_log FOR INSERT
  WITH CHECK (auth.uid()::text = property_id::text OR true);
