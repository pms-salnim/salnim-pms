-- Add missing columns to properties table and ensure proper setup
ALTER TABLE IF EXISTS public.properties
ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'Other',
ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS booking_page_settings JSONB DEFAULT '{}';

-- Create index on properties for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON public.properties(created_at);

-- Enable RLS on properties if not already enabled
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Property members can view property" ON public.properties;
DROP POLICY IF EXISTS "Property owners can update property" ON public.properties;

-- Property members can view their property
CREATE POLICY "Property members can view property"
  ON public.properties
  FOR SELECT
  USING (
    id IN (
      SELECT property_id FROM public.users WHERE auth.uid() = id
    )
  );

-- Property owners can update their property
CREATE POLICY "Property owners can update property"
  ON public.properties
  FOR UPDATE
  USING (
    id IN (
      SELECT property_id FROM public.users 
      WHERE auth.uid() = id AND role = 'owner'
    )
  );
