-- Create users table for user profiles linked to auth users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'owner',
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  phone VARCHAR(20),
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  permissions JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_property_id ON public.users(property_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile and all team members in their property
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view team members in same property"
  ON public.users
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE property_id = users.property_id
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Property owners can update team members in their property
CREATE POLICY "Property owners can update team members"
  ON public.users
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users 
      WHERE property_id = users.property_id AND role = 'owner'
    )
  );
