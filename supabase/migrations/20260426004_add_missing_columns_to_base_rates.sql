-- =====================================================
-- MIGRATION: Add all missing columns to base_rates
-- =====================================================
-- The original base_rates table only had:
--   id, property_id, room_type_id, base_price, currency,
--   start_date, end_date, is_active, created_at, updated_at
--
-- This migration adds all columns that have been added in code
-- but were never migrated to the database.

-- Occupancy pricing
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS extra_adult_price   DECIMAL(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extra_child_price   DECIMAL(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS single_use_discount DECIMAL(15, 2) DEFAULT NULL;

-- Length-of-stay restrictions
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS min_los INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_los INTEGER DEFAULT NULL;

-- Arrival / departure restrictions
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS closed_to_arrival   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS closed_to_departure BOOLEAN DEFAULT FALSE;

-- Optional rate name
ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS name TEXT DEFAULT NULL;

COMMENT ON COLUMN base_rates.extra_adult_price   IS 'Extra charge per additional adult above the standard occupancy';
COMMENT ON COLUMN base_rates.extra_child_price   IS 'Extra charge per additional child above the standard occupancy';
COMMENT ON COLUMN base_rates.single_use_discount IS 'Discount applied when only one guest occupies the room';
COMMENT ON COLUMN base_rates.min_los             IS 'Minimum length of stay (nights) required for this rate to apply';
COMMENT ON COLUMN base_rates.max_los             IS 'Maximum length of stay (nights) for this rate to apply';
COMMENT ON COLUMN base_rates.closed_to_arrival   IS 'When TRUE, guests cannot check in on this rate';
COMMENT ON COLUMN base_rates.closed_to_departure IS 'When TRUE, guests cannot check out on this rate';
COMMENT ON COLUMN base_rates.name                IS 'Optional human-readable label for this rate period';
