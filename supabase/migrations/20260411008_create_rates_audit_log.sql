-- Create rates_audit_log table
-- Comprehensive audit trail for all changes to rates, availability, restrictions, etc.
CREATE TABLE IF NOT EXISTS rates_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID,
  table_name TEXT NOT NULL CHECK (
    table_name IN (
      'rate_plans',
      'daily_rates',
      'availability_calendar',
      'restrictions',
      'occupancy_restrictions',
      'recurring_patterns',
      'seasons'
    )
  ),
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'bulk_update')),
  changes JSONB, -- {before: {field: value}, after: {field: value}}
  metadata JSONB, -- Additional context (IP, bulk operation ID, etc.)
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit queries
CREATE INDEX idx_audit_log_property_id ON rates_audit_log(property_id);
CREATE INDEX idx_audit_log_user_id ON rates_audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON rates_audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON rates_audit_log(record_id);
CREATE INDEX idx_audit_log_action ON rates_audit_log(action);
CREATE INDEX idx_audit_log_timestamp ON rates_audit_log(property_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE rates_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_policy ON rates_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rates_audit_log.property_id
    )
  );

CREATE POLICY audit_log_insert_policy ON rates_audit_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rates_audit_log.property_id
    )
  );

-- Audit log is append-only, no updates or deletes allowed
CREATE POLICY audit_log_deny_updates ON rates_audit_log
  FOR UPDATE
  USING (FALSE);

CREATE POLICY audit_log_deny_deletes ON rates_audit_log
  FOR DELETE
  USING (FALSE);
