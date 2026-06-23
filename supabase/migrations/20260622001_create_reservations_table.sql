-- Create reservations table for environments where it was never provisioned.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.reservations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,

  guest_name VARCHAR(255),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_country VARCHAR(120),
  guest_passport_id VARCHAR(120),

  source VARCHAR(50) DEFAULT 'Direct',
  status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Canceled', 'Cancelled', 'No-Show', 'Checked-in', 'Completed')),
  reservation_number VARCHAR(100),

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INT,
  adult_count INT DEFAULT 1,
  children_count INT DEFAULT 0,
  baby_count INT DEFAULT 0,

  rooms_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_extras JSONB DEFAULT '[]'::jsonb,
  selected_services JSONB DEFAULT '[]'::jsonb,
  selected_meal_plan JSONB,

  total_price NUMERIC(15, 2),
  price_before_discount NUMERIC(15, 2),
  discount_percentage NUMERIC(8, 2),
  discount_amount NUMERIC(15, 2),
  rooms_total NUMERIC(15, 2),
  extras_total NUMERIC(15, 2),
  tax_amount NUMERIC(15, 2),

  payment_status VARCHAR(50) DEFAULT 'Pending',
  partial_payment_amount NUMERIC(15, 2) DEFAULT 0,
  paid_with_points BOOLEAN DEFAULT FALSE,

  promo_code VARCHAR(100),
  promotion_applied JSONB,
  package_info JSONB,

  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  booking_source VARCHAR(50),
  original_platform VARCHAR(100),

  notes TEXT,
  special_requests TEXT,
  internal_notes TEXT,
  color VARCHAR(50),

  group_booking BOOLEAN DEFAULT FALSE,
  group_name VARCHAR(255),
  company_name VARCHAR(255),

  actual_check_in_time TIMESTAMPTZ,
  actual_check_out_time TIMESTAMPTZ,
  is_checked_out BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT reservations_valid_dates CHECK (start_date < end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_reservation_number
  ON public.reservations(reservation_number)
  WHERE reservation_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_property_id
  ON public.reservations(property_id);

CREATE INDEX IF NOT EXISTS idx_reservations_property_date_range
  ON public.reservations(property_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_reservations_status
  ON public.reservations(property_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_created_at
  ON public.reservations(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_guest_id
  ON public.reservations(guest_id);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_select_policy ON public.reservations;
CREATE POLICY reservations_select_policy ON public.reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.property_id = reservations.property_id
    )
  );

DROP POLICY IF EXISTS reservations_insert_policy ON public.reservations;
CREATE POLICY reservations_insert_policy ON public.reservations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.property_id = reservations.property_id
    )
  );

DROP POLICY IF EXISTS reservations_update_policy ON public.reservations;
CREATE POLICY reservations_update_policy ON public.reservations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.property_id = reservations.property_id
    )
  );

DROP POLICY IF EXISTS reservations_delete_policy ON public.reservations;
CREATE POLICY reservations_delete_policy ON public.reservations
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.property_id = reservations.property_id
    )
  );
