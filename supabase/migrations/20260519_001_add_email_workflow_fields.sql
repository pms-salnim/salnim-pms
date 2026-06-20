ALTER TABLE public.property_emails
ADD COLUMN IF NOT EXISTS owner_id TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'open',
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'property_emails_priority_check'
  ) THEN
    ALTER TABLE public.property_emails
    ADD CONSTRAINT property_emails_priority_check
    CHECK (priority IN ('normal', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'property_emails_sla_status_check'
  ) THEN
    ALTER TABLE public.property_emails
    ADD CONSTRAINT property_emails_sla_status_check
    CHECK (sla_status IN ('open', 'at_risk', 'breached', 'resolved'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_property_emails_priority ON public.property_emails(priority);
CREATE INDEX IF NOT EXISTS idx_property_emails_sla_due_at ON public.property_emails(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_property_emails_owner_id ON public.property_emails(owner_id);

UPDATE public.property_emails
SET
  priority = COALESCE(priority, 'normal'),
  sla_status = CASE
    WHEN is_unread = false THEN 'resolved'
    WHEN sla_due_at IS NOT NULL AND sla_due_at < now() THEN 'breached'
    WHEN sla_due_at IS NOT NULL AND sla_due_at <= now() + interval '30 minutes' THEN 'at_risk'
    ELSE 'open'
  END,
  last_inbound_at = COALESCE(last_inbound_at, date),
  updated_at = now();
