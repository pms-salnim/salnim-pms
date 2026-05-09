-- Add reason and reason_details columns to availability_calendar
-- This allows tracking why a room is blocked (Maintenance, Owner Stay, etc.)

ALTER TABLE IF EXISTS availability_calendar
ADD COLUMN IF NOT EXISTS reason TEXT CHECK (reason IN ('maintenance', 'owner_stay', 'stop_sell', 'out_of_service', 'other', NULL)),
ADD COLUMN IF NOT EXISTS reason_details TEXT;

-- Create index for filtering by reason
CREATE INDEX IF NOT EXISTS idx_availability_calendar_reason ON availability_calendar(property_id, reason, status);

-- Add comment to explain the columns
COMMENT ON COLUMN availability_calendar.reason IS 'Reason for blocking: maintenance, owner_stay, stop_sell, out_of_service, or other';
COMMENT ON COLUMN availability_calendar.reason_details IS 'Custom reason details when reason = "other"';
