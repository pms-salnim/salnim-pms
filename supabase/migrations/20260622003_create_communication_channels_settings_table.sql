-- Create the canonical communication_channels_settings table and backfill from legacy table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.communication_channels_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id)
);

-- Backfill from legacy table when available.
DO $$
BEGIN
  IF to_regclass('public.communication_channel_settings') IS NOT NULL THEN
    INSERT INTO public.communication_channels_settings (id, property_id, settings, created_at, updated_at)
    SELECT
      COALESCE(id, gen_random_uuid()),
      property_id::uuid,
      COALESCE(settings, '{}'::jsonb),
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM public.communication_channel_settings
    WHERE property_id IS NOT NULL
    ON CONFLICT (property_id)
    DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = EXCLUDED.updated_at;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_communication_channels_settings_property_id
  ON public.communication_channels_settings(property_id);

CREATE OR REPLACE FUNCTION public.set_communication_channels_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS communication_channels_settings_set_updated_at
  ON public.communication_channels_settings;

CREATE TRIGGER communication_channels_settings_set_updated_at
BEFORE UPDATE ON public.communication_channels_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_communication_channels_settings_updated_at();

ALTER TABLE public.communication_channels_settings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own property settings" ON public.communication_channels_settings;
DROP POLICY IF EXISTS "Users can insert settings for own property" ON public.communication_channels_settings;
DROP POLICY IF EXISTS "Users can update settings for own property" ON public.communication_channels_settings;
DROP POLICY IF EXISTS "Users can delete settings for own property" ON public.communication_channels_settings;
