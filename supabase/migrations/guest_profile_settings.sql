-- Create guest_profile_settings table
CREATE TABLE IF NOT EXISTS public.guest_profile_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    
    -- Store the entire settings object as JSONB for flexibility
    settings JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(property_id)
);

-- Create indexes for performance
CREATE INDEX idx_guest_profile_settings_property_id ON public.guest_profile_settings(property_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.guest_profile_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guest_profile_settings
-- Policy 1: Users can view settings for their own property
CREATE POLICY "Users can view own property settings" ON public.guest_profile_settings
    FOR SELECT
    USING (
        property_id IN (
            SELECT property_id FROM public.users 
            WHERE id = auth.uid()::TEXT
        )
    );

-- Policy 2: Users can insert settings for their property
CREATE POLICY "Users can insert settings for own property" ON public.guest_profile_settings
    FOR INSERT
    WITH CHECK (
        property_id IN (
            SELECT property_id FROM public.users 
            WHERE id = auth.uid()::TEXT
        )
    );

-- Policy 3: Users can update settings for their property
CREATE POLICY "Users can update settings for own property" ON public.guest_profile_settings
    FOR UPDATE
    USING (
        property_id IN (
            SELECT property_id FROM public.users 
            WHERE id = auth.uid()::TEXT
        )
    );

-- Policy 4: Users can delete settings for their property
CREATE POLICY "Users can delete settings for own property" ON public.guest_profile_settings
    FOR DELETE
    USING (
        property_id IN (
            SELECT property_id FROM public.users 
            WHERE id = auth.uid()::TEXT
        )
    );

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_guest_profile_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER guest_profile_settings_update_timestamp
    BEFORE UPDATE ON public.guest_profile_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_profile_settings_timestamp();
