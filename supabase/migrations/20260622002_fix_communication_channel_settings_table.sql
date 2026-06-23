-- Ensure communication channel settings table exists with correct schema.
-- Fixes earlier migrations where property_id was TEXT while properties.id is UUID.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.communication_channel_settings') IS NULL THEN
    CREATE TABLE public.communication_channel_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id UUID NOT NULL,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END
$$;

DO $$
DECLARE
  property_id_type TEXT;
BEGIN
  SELECT c.data_type
  INTO property_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'communication_channel_settings'
    AND c.column_name = 'property_id';

  IF property_id_type IS NOT NULL AND property_id_type <> 'uuid' THEN
    ALTER TABLE public.communication_channel_settings
    ALTER COLUMN property_id TYPE UUID
    USING (
      CASE
        WHEN property_id IS NULL THEN NULL
        WHEN trim(property_id::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN trim(property_id::text)::uuid
        ELSE NULL
      END
    );
  END IF;
END
$$;

-- Remove invalid rows (cannot map to a valid property UUID).
DELETE FROM public.communication_channel_settings
WHERE property_id IS NULL;

ALTER TABLE public.communication_channel_settings
  ALTER COLUMN property_id SET NOT NULL;

-- Ensure 1 row per property.
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_channel_settings_property_id_unique
  ON public.communication_channel_settings(property_id);

-- Ensure FK is present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'communication_channel_settings_property_id_fkey'
      AND conrelid = 'public.communication_channel_settings'::regclass
  ) THEN
    ALTER TABLE public.communication_channel_settings
      ADD CONSTRAINT communication_channel_settings_property_id_fkey
      FOREIGN KEY (property_id)
      REFERENCES public.properties(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_communication_channel_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS communication_channel_settings_set_updated_at
  ON public.communication_channel_settings;

CREATE TRIGGER communication_channel_settings_set_updated_at
BEFORE UPDATE ON public.communication_channel_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_communication_channel_settings_updated_at();

-- Keep this table writable from server routes using authenticated user context.
ALTER TABLE public.communication_channel_settings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own property settings" ON public.communication_channel_settings;
DROP POLICY IF EXISTS "Users can insert settings for own property" ON public.communication_channel_settings;
DROP POLICY IF EXISTS "Users can update settings for own property" ON public.communication_channel_settings;
DROP POLICY IF EXISTS "Users can delete settings for own property" ON public.communication_channel_settings;
