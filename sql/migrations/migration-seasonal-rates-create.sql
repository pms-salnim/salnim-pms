-- Migration: Create seasonal_rates table for seasonal pricing management
-- Date: 2026-04-08
-- Purpose: Support seasonal pricing overrides linked to rate plans

CREATE TABLE IF NOT EXISTS seasonal_rates (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  rate_plan_id TEXT NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  base_price DECIMAL(15, 2),
  pricing_per_guest JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_property_id ON seasonal_rates(property_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_rate_plan_id ON seasonal_rates(rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_is_active ON seasonal_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_date_range ON seasonal_rates(start_date, end_date);

-- Enable RLS on seasonal_rates
ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for seasonal_rates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'seasonal_rates' 
    AND policyname = 'seasonal_rates_rls_select'
  ) THEN
    CREATE POLICY seasonal_rates_rls_select ON seasonal_rates
      FOR SELECT
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'seasonal_rates' 
    AND policyname = 'seasonal_rates_rls_insert'
  ) THEN
    CREATE POLICY seasonal_rates_rls_insert ON seasonal_rates
      FOR INSERT
      WITH CHECK (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'seasonal_rates' 
    AND policyname = 'seasonal_rates_rls_update'
  ) THEN
    CREATE POLICY seasonal_rates_rls_update ON seasonal_rates
      FOR UPDATE
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'seasonal_rates' 
    AND policyname = 'seasonal_rates_rls_delete'
  ) THEN
    CREATE POLICY seasonal_rates_rls_delete ON seasonal_rates
      FOR DELETE
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;
