ALTER TABLE public.property_emails
ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound',
ADD COLUMN IF NOT EXISTS to_name TEXT,
ADD COLUMN IF NOT EXISTS to_email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'property_emails_direction_check'
  ) THEN
    ALTER TABLE public.property_emails
    ADD CONSTRAINT property_emails_direction_check
    CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END
$$;

UPDATE public.property_emails
SET direction = COALESCE(direction, 'inbound')
WHERE direction IS NULL;

CREATE INDEX IF NOT EXISTS idx_property_emails_direction ON public.property_emails(direction);
CREATE INDEX IF NOT EXISTS idx_property_emails_to_email ON public.property_emails(to_email);
