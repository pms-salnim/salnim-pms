-- Helper function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rate_plans
DROP TRIGGER IF EXISTS update_rate_plans_updated_at ON rate_plans;
CREATE TRIGGER update_rate_plans_updated_at
BEFORE UPDATE ON rate_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for daily_rates
DROP TRIGGER IF EXISTS update_daily_rates_updated_at ON daily_rates;
CREATE TRIGGER update_daily_rates_updated_at
BEFORE UPDATE ON daily_rates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for availability_calendar
DROP TRIGGER IF EXISTS update_availability_calendar_updated_at ON availability_calendar;
CREATE TRIGGER update_availability_calendar_updated_at
BEFORE UPDATE ON availability_calendar
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for restrictions
DROP TRIGGER IF EXISTS update_restrictions_updated_at ON restrictions;
CREATE TRIGGER update_restrictions_updated_at
BEFORE UPDATE ON restrictions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for occupancy_restrictions
DROP TRIGGER IF EXISTS update_occupancy_restrictions_updated_at ON occupancy_restrictions;
CREATE TRIGGER update_occupancy_restrictions_updated_at
BEFORE UPDATE ON occupancy_restrictions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for recurring_patterns
DROP TRIGGER IF EXISTS update_recurring_patterns_updated_at ON recurring_patterns;
CREATE TRIGGER update_recurring_patterns_updated_at
BEFORE UPDATE ON recurring_patterns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for seasons
DROP TRIGGER IF EXISTS update_seasons_updated_at ON seasons;
CREATE TRIGGER update_seasons_updated_at
BEFORE UPDATE ON seasons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to get applicable rate (hierarchical resolution)
CREATE OR REPLACE FUNCTION get_applicable_rate(
  p_property_id TEXT,
  p_rate_plan_id TEXT,
  p_room_id TEXT,
  p_room_type_id TEXT,
  p_date DATE
)
RETURNS TABLE(rate_id TEXT, base_price DECIMAL, occupancy_price DECIMAL) AS $$
BEGIN
  -- Try room-level rate first
  RETURN QUERY
  SELECT id, base_price, occupancy_price
  FROM daily_rates
  WHERE property_id = p_property_id
    AND rate_plan_id = p_rate_plan_id
    AND room_id = p_room_id
    AND date = p_date
  LIMIT 1;

  -- If not found, try room_type level
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT id, base_price, occupancy_price
    FROM daily_rates
    WHERE property_id = p_property_id
      AND rate_plan_id = p_rate_plan_id
      AND room_type_id = p_room_type_id
      AND room_id IS NULL
      AND date = p_date
    LIMIT 1;
  END IF;

  -- If not found, try property level
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT id, base_price, occupancy_price
    FROM daily_rates
    WHERE property_id = p_property_id
      AND rate_plan_id = p_rate_plan_id
      AND room_type_id IS NULL
      AND room_id IS NULL
      AND date = p_date
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get applicable availability (hierarchical resolution)
CREATE OR REPLACE FUNCTION get_applicable_availability(
  p_property_id TEXT,
  p_room_id TEXT,
  p_room_type_id TEXT,
  p_date DATE
)
RETURNS TABLE(
  avail_id TEXT,
  status availability_status,
  min_nights INTEGER,
  max_nights INTEGER
) AS $$
BEGIN
  -- Try room-level availability first
  RETURN QUERY
  SELECT id, status, min_nights, max_nights
  FROM availability_calendar
  WHERE property_id = p_property_id
    AND room_id = p_room_id
    AND date = p_date
  LIMIT 1;

  -- If not found, try room_type level
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT id, status, min_nights, max_nights
    FROM availability_calendar
    WHERE property_id = p_property_id
      AND room_type_id = p_room_type_id
      AND room_id IS NULL
      AND date = p_date
    LIMIT 1;
  END IF;

  -- If not found, try property level
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT id, status, min_nights, max_nights
    FROM availability_calendar
    WHERE property_id = p_property_id
      AND room_type_id IS NULL
      AND room_id IS NULL
      AND date = p_date
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to log rate changes
CREATE OR REPLACE FUNCTION log_rates_change()
RETURNS TRIGGER AS $$
DECLARE
  audit_id TEXT;
BEGIN
  -- Generate audit ID
  audit_id := encode(digest(TG_TABLE_NAME || NEW.id || NOW()::text, 'sha256'), 'hex')::text;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO rates_audit_log (
      id,
      property_id,
      table_name,
      record_id,
      action,
      changes,
      metadata
    ) VALUES (
      audit_id,
      COALESCE(NEW.property_id, OLD.property_id),
      TG_TABLE_NAME,
      NEW.id,
      'create'::audit_action,
      row_to_json(NEW),
      jsonb_build_object('user_id', auth.uid())
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
      metadata
    ) VALUES (
      audit_id,
      NEW.property_id,
      TG_TABLE_NAME,
      NEW.id,
      'update'::audit_action,
      jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)),
      jsonb_build_object('user_id', auth.uid())
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
      metadata
    ) VALUES (
      audit_id,
      OLD.property_id,
      TG_TABLE_NAME,
      OLD.id,
      'delete'::audit_action,
      row_to_json(OLD),
      jsonb_build_object('user_id', auth.uid())
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach audit logging triggers to all tables
DROP TRIGGER IF EXISTS audit_daily_rates ON daily_rates;
CREATE TRIGGER audit_daily_rates AFTER INSERT OR UPDATE OR DELETE ON daily_rates FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS audit_availability ON availability_calendar;
CREATE TRIGGER audit_availability AFTER INSERT OR UPDATE OR DELETE ON availability_calendar FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS audit_restrictions ON restrictions;
CREATE TRIGGER audit_restrictions AFTER INSERT OR UPDATE OR DELETE ON restrictions FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS audit_rate_plans ON rate_plans;
CREATE TRIGGER audit_rate_plans AFTER INSERT OR UPDATE OR DELETE ON rate_plans FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS audit_occupancy ON occupancy_restrictions;
CREATE TRIGGER audit_occupancy AFTER INSERT OR UPDATE OR DELETE ON occupancy_restrictions FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS audit_patterns ON recurring_patterns;
CREATE TRIGGER audit_patterns AFTER INSERT OR UPDATE OR DELETE ON recurring_patterns FOR EACH ROW EXECUTE FUNCTION log_rates_change();

DROP TRIGGER IF EXISTS audit_seasons ON seasons;
CREATE TRIGGER audit_seasons AFTER INSERT OR UPDATE OR DELETE ON seasons FOR EACH ROW EXECUTE FUNCTION log_rates_change();
