-- Add reservation linkage metadata for guest portal mirrored inbox rows.
-- This enables robust reservation-number resolution for guest-portal-only threads.

ALTER TABLE public.property_emails
  ADD COLUMN IF NOT EXISTS source_reservation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_property_emails_source_reservation
  ON public.property_emails(property_id, source, source_reservation_id, date_ms DESC);
