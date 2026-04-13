-- Create email_templates table for storing email template configurations
-- This table stores customized email templates per property with support for multiple languages

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  subject TEXT,
  preheader_text TEXT,
  html_content TEXT,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  cc_list TEXT,
  bcc_list TEXT,
  email_type TEXT DEFAULT 'transactional',
  languages TEXT[] DEFAULT '{"en"}',
  signature_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, template_id)
);

-- Create index for faster property_id lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_property_id 
  ON public.email_templates(property_id);

-- Create index for template_id lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_template_id 
  ON public.email_templates(template_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_templates_update_timestamp ON public.email_templates;

CREATE TRIGGER email_templates_update_timestamp
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION update_email_templates_timestamp();
