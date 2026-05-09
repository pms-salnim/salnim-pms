-- Align reservations table with the New Reservation form + API payloads.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_name character varying(255),
  ADD COLUMN IF NOT EXISTS guest_email character varying(255),
  ADD COLUMN IF NOT EXISTS guest_phone character varying(50),
  ADD COLUMN IF NOT EXISTS guest_country character varying(120),
  ADD COLUMN IF NOT EXISTS guest_passport_id character varying(120),
  ADD COLUMN IF NOT EXISTS source character varying(50) DEFAULT 'Direct',
  ADD COLUMN IF NOT EXISTS reservation_number character varying(100),
  ADD COLUMN IF NOT EXISTS rooms_total numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras_total numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_before_discount numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status character varying(50) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS partial_payment_amount numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS paid_with_points boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS package_info jsonb,
  ADD COLUMN IF NOT EXISTS color character varying(20),
  ADD COLUMN IF NOT EXISTS actual_check_in_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS actual_check_out_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_checked_out boolean DEFAULT false;

-- Backfill from legacy columns where possible.
UPDATE public.reservations
SET
  guest_email = COALESCE(guest_email, contact_email),
  guest_phone = COALESCE(guest_phone, contact_phone),
  source = COALESCE(source, booking_source),
  notes = COALESCE(notes, internal_notes),
  rooms_total = COALESCE(rooms_total, base_price),
  price_before_discount = COALESCE(price_before_discount, base_price),
  partial_payment_amount = COALESCE(partial_payment_amount, 0),
  is_checked_out = COALESCE(is_checked_out, false)
WHERE
  guest_email IS NULL
  OR guest_phone IS NULL
  OR source IS NULL
  OR notes IS NULL
  OR rooms_total IS NULL
  OR price_before_discount IS NULL
  OR partial_payment_amount IS NULL
  OR is_checked_out IS NULL;

-- New Reservation flow can create reservations before a guest record exists.
ALTER TABLE public.reservations
  ALTER COLUMN guest_id DROP NOT NULL;

-- Keep INSERT working when id is omitted by API payload.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'id'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE public.reservations
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_payment_status
  ON public.reservations (payment_status);

CREATE INDEX IF NOT EXISTS idx_reservations_is_checked_out
  ON public.reservations (is_checked_out);

CREATE INDEX IF NOT EXISTS idx_reservations_reservation_number
  ON public.reservations (reservation_number);

COMMIT;
