-- Create roles table for role-based access control
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  property_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}' NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roles_property_id ON public.roles(property_id);
CREATE INDEX IF NOT EXISTS idx_roles_status ON public.roles(status);
CREATE INDEX IF NOT EXISTS idx_roles_property_status ON public.roles(property_id, status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Optional: Create RLS policies if needed (can be managed via API security layer)
-- For now, security is managed at the API level like team_members table

-- Create trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_roles_timestamp
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_roles_timestamp();
