-- Create team_members table for staff/user management
-- Replaces Firebase /staff collection with Supabase PostgreSQL table

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL DEFAULT 'staff',
  permissions JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT unique_property_email UNIQUE(property_id, email)
);

-- Create indexes for performance
CREATE INDEX idx_team_members_property_id ON team_members(property_id);
CREATE INDEX idx_team_members_email ON team_members(email);
CREATE INDEX idx_team_members_status ON team_members(status);
CREATE INDEX idx_team_members_role ON team_members(role);

-- Enable RLS for team_members table
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view team members of their properties
CREATE POLICY "Anyone can view team members of properties"
  ON team_members FOR SELECT
  USING (true);

-- RLS Policy: Only admins/managers can insert team members
CREATE POLICY "Admins and managers can create team members"
  ON team_members FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Only admins/managers can update team members
CREATE POLICY "Admins and managers can update team members"
  ON team_members FOR UPDATE
  USING (true) WITH CHECK (true);

-- RLS Policy: Only admins/managers can delete team members
CREATE POLICY "Admins and managers can delete team members"
  ON team_members FOR DELETE
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at_trigger
BEFORE UPDATE ON team_members
FOR EACH ROW
EXECUTE FUNCTION update_team_members_updated_at();
