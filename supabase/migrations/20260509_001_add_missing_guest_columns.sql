-- Add guest-profile columns used by the app but missing from some deployments.
-- This migration is idempotent and safe to run multiple times.

BEGIN;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS passport_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_status VARCHAR(20) DEFAULT 'not-enrolled',
  ADD COLUMN IF NOT EXISTS spend_for_next_point NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points_earned INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points_redeemed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_preferences TEXT,
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS special_occasion TEXT,
  ADD COLUMN IF NOT EXISTS communication_preference VARCHAR(50);

-- Backfill practical defaults for existing rows.
UPDATE public.guests
SET
  loyalty_status = COALESCE(loyalty_status, 'not-enrolled'),
  nationality = COALESCE(nationality, country),
  total_points_earned = COALESCE(total_points_earned, loyalty_points, 0),
  total_points_redeemed = COALESCE(total_points_redeemed, 0),
  spend_for_next_point = COALESCE(spend_for_next_point, 0)
WHERE
  loyalty_status IS NULL
  OR nationality IS NULL
  OR total_points_earned IS NULL
  OR total_points_redeemed IS NULL
  OR spend_for_next_point IS NULL;

UPDATE public.guests
SET passport_id = COALESCE(passport_id, id_number)
WHERE passport_id IS NULL AND id_number IS NOT NULL;

ALTER TABLE public.guests
  ALTER COLUMN loyalty_status SET DEFAULT 'not-enrolled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guests_loyalty_status_check'
      AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_loyalty_status_check
      CHECK (loyalty_status IN ('enrolled', 'not-enrolled'));
  END IF;
END $$;

COMMIT;
