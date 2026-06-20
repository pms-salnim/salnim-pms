-- Fix rates_audit_log schema to match TEXT-based IDs in availability_calendar
-- Previously, property_id and record_id were UUID, but now they're TEXT

-- Step 1: Drop RLS policies that depend on property_id
DROP POLICY IF EXISTS audit_log_select_policy ON rates_audit_log;
DROP POLICY IF EXISTS audit_log_insert_policy ON rates_audit_log;
DROP POLICY IF EXISTS audit_log_deny_updates ON rates_audit_log;
DROP POLICY IF EXISTS audit_log_deny_deletes ON rates_audit_log;
DROP POLICY IF EXISTS audit_select ON rates_audit_log;
DROP POLICY IF EXISTS audit_insert ON rates_audit_log;

-- Step 2: Drop the existing foreign key constraint (if it exists)
ALTER TABLE rates_audit_log
DROP CONSTRAINT IF EXISTS rates_audit_log_property_id_fkey;

-- Step 3: Add new columns with TEXT type
ALTER TABLE rates_audit_log
ADD COLUMN property_id_new TEXT,
ADD COLUMN record_id_new TEXT;

-- Step 4: Copy data from old columns to new (converting UUID to TEXT)
UPDATE rates_audit_log
SET 
  property_id_new = property_id::TEXT,
  record_id_new = record_id::TEXT;

-- Step 5: Drop old columns
ALTER TABLE rates_audit_log
DROP COLUMN property_id,
DROP COLUMN record_id;

-- Step 6: Rename new columns to original names
ALTER TABLE rates_audit_log
RENAME COLUMN property_id_new TO property_id;

ALTER TABLE rates_audit_log
RENAME COLUMN record_id_new TO record_id;

-- Step 7: Add NOT NULL constraints
ALTER TABLE rates_audit_log
ALTER COLUMN property_id SET NOT NULL,
ALTER COLUMN record_id SET NOT NULL;

-- Step 8: Recreate RLS policies with TEXT column support
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

CREATE POLICY audit_log_deny_updates ON rates_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY audit_log_deny_deletes ON rates_audit_log
  FOR DELETE
  USING (false);

-- Step 9: Create index for property_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_property_id ON rates_audit_log(property_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON rates_audit_log(record_id);

-- Step 10: Update the audit trigger function to handle TEXT IDs properly
CREATE OR REPLACE FUNCTION log_rates_change()
RETURNS TRIGGER AS $$
DECLARE
  audit_id UUID;
BEGIN
  audit_id := gen_random_uuid();
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO rates_audit_log (
      id,
      property_id,
      table_name,
      record_id,
      action,
      changes,
      metadata,
      user_id
    ) VALUES (
      audit_id,
      COALESCE(NEW.property_id::TEXT, ''),
      TG_TABLE_NAME,
      NEW.id::TEXT,
      'create'::audit_action,
      row_to_json(NEW),
      jsonb_build_object('user_id', COALESCE(auth.uid()::TEXT, 'system')),
      auth.uid()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO rates_audit_log (
      id,
      property_id,
      table_name,
      record_id,
      action,
      changes,
      metadata,
      user_id
    ) VALUES (
      audit_id,
      COALESCE(NEW.property_id::TEXT, ''),
      TG_TABLE_NAME,
      NEW.id::TEXT,
      'update'::audit_action,
      jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)),
      jsonb_build_object('user_id', COALESCE(auth.uid()::TEXT, 'system')),
      auth.uid()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO rates_audit_log (
      id,
      property_id,
      table_name,
      record_id,
      action,
      changes,
      metadata,
      user_id
    ) VALUES (
      audit_id,
      COALESCE(OLD.property_id::TEXT, ''),
      TG_TABLE_NAME,
      OLD.id::TEXT,
      'delete'::audit_action,
      row_to_json(OLD),
      jsonb_build_object('user_id', COALESCE(auth.uid()::TEXT, 'system')),
      auth.uid()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
