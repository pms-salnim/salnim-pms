-- =====================================================
-- MIGRATION: Implement Base Rate Derivation System
-- =====================================================
-- This migration restructures rate management to use:
-- 1. Base rates (source of truth)
-- 2. Rate plans with adjustment rules (formulas)
-- 3. Dynamic price calculation instead of storing final prices

-- =====================================================
-- 1. CREATE base_rates TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS base_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  
  base_price DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MAD',
  
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL means open-ended
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(property_id, room_type_id, start_date)
);

CREATE INDEX idx_base_rates_property_room_date ON base_rates(property_id, room_type_id, start_date, end_date);

COMMENT ON TABLE base_rates IS 'Stores the base price per room type and date range. This is the source of truth.';
COMMENT ON COLUMN base_rates.base_price IS 'The base price from which all rate plans derive';
COMMENT ON COLUMN base_rates.start_date IS 'Start date when this rate applies';
COMMENT ON COLUMN base_rates.end_date IS 'End date (NULL = no end date)';

-- =====================================================
-- 2. MODIFY rate_plans TABLE - Add adjustment fields
-- =====================================================
ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(50) DEFAULT 'none' CHECK (adjustment_type IN ('none', 'fixed', 'percentage'));
ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS adjustment_value DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS is_derived_from_base BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN rate_plans.adjustment_type IS 'How to adjust the base rate: none (use base), fixed (add amount), percentage (add percentage)';
COMMENT ON COLUMN rate_plans.adjustment_value IS 'The adjustment amount/percentage';
COMMENT ON COLUMN rate_plans.is_derived_from_base IS 'If TRUE, price = base_rate + adjustment. If FALSE, use nightly_rate directly';

-- =====================================================
-- 3. CREATE rate_plan_overrides TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_plan_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rate_plan_id UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  
  date_date DATE NOT NULL,
  override_price DECIMAL(15, 2) NOT NULL,
  reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(rate_plan_id, date_date)
);

CREATE INDEX idx_rate_plan_overrides_date ON rate_plan_overrides(rate_plan_id, date_date);

COMMENT ON TABLE rate_plan_overrides IS 'Exception prices for specific dates. Overrides calculated price.';
COMMENT ON COLUMN rate_plan_overrides.override_price IS 'If set, use this price instead of calculating from base + adjustment';

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE base_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_plan_overrides ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================
CREATE POLICY "base_rates_select_by_property" ON base_rates
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "base_rates_insert_by_property_owner" ON base_rates
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "base_rates_update_by_property_owner" ON base_rates
  FOR UPDATE USING (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "base_rates_delete_by_property_owner" ON base_rates
  FOR DELETE USING (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "rate_plan_overrides_select" ON rate_plan_overrides
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "rate_plan_overrides_insert" ON rate_plan_overrides
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "rate_plan_overrides_update" ON rate_plan_overrides
  FOR UPDATE USING (
    property_id IN (
      SELECT id FROM properties
    )
  );

CREATE POLICY "rate_plan_overrides_delete" ON rate_plan_overrides
  FOR DELETE USING (
    property_id IN (
      SELECT id FROM properties
    )
  );
