-- Migration: Add visibility and status fields to services table
-- Purpose: Support filtering by booking engine, guest portal, staff only, and status

BEGIN;

-- Add visibility fields
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS booking_engine BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guest_portal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS staff_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Draft', 'Archived'));

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

-- Add comments
COMMENT ON COLUMN services.booking_engine IS 'Whether service is available in booking engine';
COMMENT ON COLUMN services.guest_portal IS 'Whether service is available in guest portal';
COMMENT ON COLUMN services.staff_only IS 'Whether service is staff-only';
COMMENT ON COLUMN services.status IS 'Service status: Active, Draft, or Archived';

COMMIT;
