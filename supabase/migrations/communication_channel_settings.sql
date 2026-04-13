-- Create communication_channel_settings table for storing communication channel configurations
-- This table stores email and WhatsApp integration settings per property

CREATE TABLE IF NOT EXISTS public.communication_channel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id)
);

-- Create index for faster property_id lookups
CREATE INDEX IF NOT EXISTS idx_communication_channel_settings_property_id 
  ON public.communication_channel_settings(property_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_communication_channel_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS communication_channel_settings_update_timestamp ON public.communication_channel_settings;

CREATE TRIGGER communication_channel_settings_update_timestamp
BEFORE UPDATE ON public.communication_channel_settings
FOR EACH ROW
EXECUTE FUNCTION update_communication_channel_settings_timestamp();
