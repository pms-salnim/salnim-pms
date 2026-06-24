-- Add channel-source metadata to property_emails so non-email channels (guest portal, whatsapp)
-- can be represented as first-class inbox threads with stable conversation linking.

ALTER TABLE public.property_emails
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS source_sender_type TEXT,
  ADD COLUMN IF NOT EXISTS source_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS source_message_id TEXT;

UPDATE public.property_emails
SET source = COALESCE(NULLIF(source, ''), 'email')
WHERE source IS NULL OR source = '';

CREATE INDEX IF NOT EXISTS idx_property_emails_source
  ON public.property_emails(property_id, source, date_ms DESC);

CREATE INDEX IF NOT EXISTS idx_property_emails_source_conversation
  ON public.property_emails(property_id, source, source_conversation_id, date_ms DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_emails_source_message_unique
  ON public.property_emails(source, source_message_id)
  WHERE source_message_id IS NOT NULL AND source_message_id <> '';
