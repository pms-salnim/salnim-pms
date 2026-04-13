-- Add end_date column to availability_calendar for range-based storage
-- This allows storing continuous availability ranges instead of individual date records

ALTER TABLE availability_calendar 
ADD COLUMN end_date DATE DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN availability_calendar.end_date IS 'End date of the availability range (inclusive). If NULL or same as date, single-day record. NULL means open-ended.';

-- Create index for range queries
CREATE INDEX IF NOT EXISTS idx_availability_date_range_query 
ON availability_calendar(property_id, date, end_date);

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_availability_range_lookup 
ON availability_calendar(property_id, room_type_id, room_id, date, end_date);
