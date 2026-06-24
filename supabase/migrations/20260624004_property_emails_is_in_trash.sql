-- Add explicit thread trash state flag for communication flows.
ALTER TABLE public.property_emails
ADD COLUMN IF NOT EXISTS is_in_trash boolean NOT NULL DEFAULT false;

-- Backfill from legacy flag so existing trash state is preserved.
UPDATE public.property_emails
SET is_in_trash = COALESCE(is_trash, false)
WHERE is_in_trash IS DISTINCT FROM COALESCE(is_trash, false);

-- Optional helper index for common folder queries.
CREATE INDEX IF NOT EXISTS idx_property_emails_property_in_trash_date
ON public.property_emails (property_id, is_in_trash, date_ms DESC);
