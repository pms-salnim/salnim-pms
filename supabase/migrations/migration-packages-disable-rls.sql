-- Migration: Disable RLS for packages
-- Purpose: Allow anon key access with server-side security from API

BEGIN;

-- Disable RLS on packages (security handled at API level)
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;

COMMIT;
