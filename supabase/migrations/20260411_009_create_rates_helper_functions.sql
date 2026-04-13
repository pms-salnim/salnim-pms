-- Helper functions and utilities for rates and availability system
-- This ensures required functions exist for all migrations

-- Create or replace the update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to resolve rate at specific scope level
-- Returns the rate for a given date, considering inheritance hierarchy
CREATE OR REPLACE FUNCTION get_applicable_rate(
  p_property_id UUID,
  p_rate_plan_id UUID,
  p_room_id UUID,
  p_room_type_id UUID,
  p_date DATE
)
RETURNS DECIMAL AS $$
DECLARE
  v_rate DECIMAL;
BEGIN
  -- Try room-specific rate first
  IF p_room_id IS NOT NULL THEN
    SELECT base_price INTO v_rate
    FROM daily_rates
    WHERE property_id = p_property_id
      AND rate_plan_id = p_rate_plan_id
      AND room_id = p_room_id
      AND date = p_date
    LIMIT 1;
    
    IF v_rate IS NOT NULL THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- Try room-type level rate
  IF p_room_type_id IS NOT NULL THEN
    SELECT base_price INTO v_rate
    FROM daily_rates
    WHERE property_id = p_property_id
      AND rate_plan_id = p_rate_plan_id
      AND room_type_id = p_room_type_id
      AND room_id IS NULL
      AND date = p_date
    LIMIT 1;
    
    IF v_rate IS NOT NULL THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- Fall back to property-level rate
  SELECT base_price INTO v_rate
  FROM daily_rates
  WHERE property_id = p_property_id
    AND rate_plan_id = p_rate_plan_id
    AND room_id IS NULL
    AND room_type_id IS NULL
    AND date = p_date
  LIMIT 1;

  RETURN v_rate;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to get applicable availability status
CREATE OR REPLACE FUNCTION get_applicable_availability(
  p_property_id UUID,
  p_room_id UUID,
  p_room_type_id UUID,
  p_date DATE
)
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Try room-specific status first
  IF p_room_id IS NOT NULL THEN
    SELECT status INTO v_status
    FROM availability_calendar
    WHERE property_id = p_property_id
      AND room_id = p_room_id
      AND date = p_date
    LIMIT 1;
    
    IF v_status IS NOT NULL THEN
      RETURN v_status;
    END IF;
  END IF;

  -- Try room-type level status
  IF p_room_type_id IS NOT NULL THEN
    SELECT status INTO v_status
    FROM availability_calendar
    WHERE property_id = p_property_id
      AND room_type_id = p_room_type_id
      AND room_id IS NULL
      AND date = p_date
    LIMIT 1;
    
    IF v_status IS NOT NULL THEN
      RETURN v_status;
    END IF;
  END IF;

  -- Fall back to property-level status
  SELECT status INTO v_status
  FROM availability_calendar
  WHERE property_id = p_property_id
    AND room_id IS NULL
    AND room_type_id IS NULL
    AND date = p_date
  LIMIT 1;

  RETURN COALESCE(v_status, 'available');
END;
$$ LANGUAGE plpgsql;

-- Function to log changes to audit table
CREATE OR REPLACE FUNCTION log_rates_change()
RETURNS TRIGGER AS $$
DECLARE
  v_changes JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO rates_audit_log (
      property_id,
      table_name,
      record_id,
      action,
      changes,
      timestamp
    ) VALUES (
      NEW.property_id,
      TG_TABLE_NAME,
      NEW.id,
      'create',
      jsonb_build_object('after', row_to_json(NEW)),
      CURRENT_TIMESTAMP
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'before', row_to_json(OLD),
      'after', row_to_json(NEW)
    );
    INSERT INTO rates_audit_log (
      property_id,
      table_name,
      record_id,
      action,
      changes,
      timestamp
    ) VALUES (
      NEW.property_id,
      TG_TABLE_NAME,
      NEW.id,
      'update',
      v_changes,
      CURRENT_TIMESTAMP
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO rates_audit_log (
      property_id,
      table_name,
      record_id,
      action,
      changes,
      timestamp
    ) VALUES (
      OLD.property_id,
      TG_TABLE_NAME,
      OLD.id,
      'delete',
      jsonb_build_object('before', row_to_json(OLD)),
      CURRENT_TIMESTAMP
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach audit logging triggers to all main tables
DROP TRIGGER IF EXISTS daily_rates_audit_trigger ON daily_rates;
CREATE TRIGGER daily_rates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON daily_rates
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS availability_calendar_audit_trigger ON availability_calendar;
CREATE TRIGGER availability_calendar_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON availability_calendar
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS restrictions_audit_trigger ON restrictions;
CREATE TRIGGER restrictions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON restrictions
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS occupancy_restrictions_audit_trigger ON occupancy_restrictions;
CREATE TRIGGER occupancy_restrictions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON occupancy_restrictions
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS recurring_patterns_audit_trigger ON recurring_patterns;
CREATE TRIGGER recurring_patterns_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON recurring_patterns
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS rate_plans_audit_trigger ON rate_plans;
CREATE TRIGGER rate_plans_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON rate_plans
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS seasons_audit_trigger ON seasons;
CREATE TRIGGER seasons_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON seasons
  FOR EACH ROW EXECUTE FUNCTION log_rates_change();
