-- =====================================================
-- MIGRATION: Add per-day pricing to base_rates
-- =====================================================
-- Adds:
--   day_prices   JSONB  — per-day price map  {"MON": 150.00, "TUE": 120.00, ...}
--   applied_days TEXT[] — which days this rate is active for
-- base_price is kept as the fallback / default price (average of enabled days).

ALTER TABLE base_rates
  ADD COLUMN IF NOT EXISTS day_prices JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applied_days TEXT[] DEFAULT ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'];

COMMENT ON COLUMN base_rates.day_prices IS
  'Per-day price map. Keys are 3-letter day codes (MON-SUN), values are decimal prices. '
  'If a day key is absent, base_price is used as the fallback.';

COMMENT ON COLUMN base_rates.applied_days IS
  'Array of day codes for which this base rate is active. '
  'Days not listed are treated as closed/unavailable under this rate.';

-- Index on applied_days for filtering
CREATE INDEX IF NOT EXISTS idx_base_rates_applied_days
  ON base_rates USING GIN (applied_days);
