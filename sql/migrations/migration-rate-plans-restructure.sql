-- Migration: Add missing fields to rate_plans table to support Firestore schema
-- Date: 2026-04-08
-- Purpose: Support complex pricing structure (per guest vs per night) and additional fields

-- Add missing columns to rate_plans table
ALTER TABLE rate_plans
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS pricing_method VARCHAR(20) CHECK (pricing_method IN ('per_guest', 'per_night')) DEFAULT 'per_guest',
ADD COLUMN IF NOT EXISTS pricing_per_guest JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Rename existing columns for consistency
ALTER TABLE rate_plans
RENAME COLUMN name TO plan_name;

ALTER TABLE rate_plans
RENAME COLUMN nightly_rate TO base_price_legacy;

-- Add index for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_rate_plans_is_default ON rate_plans(property_id, room_type_id, is_default);
CREATE INDEX IF NOT EXISTS idx_rate_plans_date_range ON rate_plans(property_id, start_date, end_date);

-- Add RLS policy for rate_plans (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rate_plans' 
    AND policyname = 'rate_plans_rls_select'
  ) THEN
    CREATE POLICY rate_plans_rls_select ON rate_plans
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
    WHERE tablename = 'rate_plans' 
    AND policyname = 'rate_plans_rls_insert'
  ) THEN
    CREATE POLICY rate_plans_rls_insert ON rate_plans
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
    WHERE tablename = 'rate_plans' 
    AND policyname = 'rate_plans_rls_update'
  ) THEN
    CREATE POLICY rate_plans_rls_update ON rate_plans
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
    WHERE tablename = 'rate_plans' 
    AND policyname = 'rate_plans_rls_delete'
  ) THEN
    CREATE POLICY rate_plans_rls_delete ON rate_plans
      FOR DELETE
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;
