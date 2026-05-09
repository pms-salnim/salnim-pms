-- =====================================================
-- MIGRATION: Consolidate all missing base_rates columns
-- =====================================================
-- Safely adds ALL columns that migrations 002 + 003 + 004
-- were supposed to add. Uses IF NOT EXISTS throughout so
-- it is safe to run even if some columns already exist.
-- Run this once in the Supabase SQL editor to resolve all
-- "column not found in schema cache" errors at once.
-- =====================================================

-- From 20260426_002: price-type enum columns
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS extra_adult_price_type   VARCHAR(20) DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS extra_child_price_type   VARCHAR(20) DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS single_use_discount_type VARCHAR(20) DEFAULT 'percentage';

-- From 20260426_004: occupancy + restriction columns
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS extra_adult_price   DECIMAL(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extra_child_price   DECIMAL(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS single_use_discount DECIMAL(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_los             INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_los             INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closed_to_arrival   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS closed_to_departure BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS name                TEXT DEFAULT NULL;

-- From 20260426_003: per-day pricing
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS day_prices   JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applied_days TEXT[]  DEFAULT ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'];

-- Check constraints (safe — will error if already exist; ignore if so)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_extra_adult_price_type' AND conrelid = 'base_rates'::regclass
  ) THEN
    ALTER TABLE base_rates
      ADD CONSTRAINT check_extra_adult_price_type
      CHECK (extra_adult_price_type IN ('fixed', 'percentage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_extra_child_price_type' AND conrelid = 'base_rates'::regclass
  ) THEN
    ALTER TABLE base_rates
      ADD CONSTRAINT check_extra_child_price_type
      CHECK (extra_child_price_type IN ('fixed', 'percentage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_single_use_discount_type' AND conrelid = 'base_rates'::regclass
  ) THEN
    ALTER TABLE base_rates
      ADD CONSTRAINT check_single_use_discount_type
      CHECK (single_use_discount_type IN ('fixed', 'percentage'));
  END IF;
END $$;

-- Index for applied_days GIN search
CREATE INDEX IF NOT EXISTS idx_base_rates_applied_days
  ON base_rates USING GIN (applied_days);

-- Comments
COMMENT ON COLUMN base_rates.extra_adult_price_type   IS 'Type of extra adult charge: fixed amount or percentage of base price';
COMMENT ON COLUMN base_rates.extra_child_price_type   IS 'Type of extra child charge: fixed amount or percentage of base price';
COMMENT ON COLUMN base_rates.single_use_discount_type IS 'Type of single-occupancy discount: fixed amount or percentage of final price';
COMMENT ON COLUMN base_rates.extra_adult_price        IS 'Extra charge per additional adult above standard occupancy';
COMMENT ON COLUMN base_rates.extra_child_price        IS 'Extra charge per additional child above standard occupancy';
COMMENT ON COLUMN base_rates.single_use_discount      IS 'Discount applied when only one guest occupies the room';
COMMENT ON COLUMN base_rates.min_los                  IS 'Minimum length of stay (nights) required for this rate to apply';
COMMENT ON COLUMN base_rates.max_los                  IS 'Maximum length of stay (nights) for this rate to apply';
COMMENT ON COLUMN base_rates.closed_to_arrival        IS 'When TRUE, guests cannot check in on this rate';
COMMENT ON COLUMN base_rates.closed_to_departure      IS 'When TRUE, guests cannot check out on this rate';
COMMENT ON COLUMN base_rates.name                     IS 'Optional human-readable label for this rate period';
COMMENT ON COLUMN base_rates.day_prices               IS 'Per-day price map. Keys are 3-letter day codes (MON-SUN), values are decimal prices.';
COMMENT ON COLUMN base_rates.applied_days             IS 'Array of day codes for which this base rate is active.';
