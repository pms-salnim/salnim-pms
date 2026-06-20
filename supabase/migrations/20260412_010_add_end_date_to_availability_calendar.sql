-- Add end_date column to availability_calendar table
-- This column supports open-ended availability periods
-- When end_date is '9999-12-31', the availability applies indefinitely

-- Add the end_date column
ALTER TABLE availability_calendar
ADD COLUMN end_date DATE;

-- Set default end_date to NULL for existing records (will be updated in app logic)
UPDATE availability_calendar
SET end_date = NULL
WHERE end_date IS NULL;

-- Create index for date range queries to improve performance
CREATE INDEX idx_availability_calendar_date_range_inclusive
  ON availability_calendar(property_id, date, end_date)
  WHERE status = 'available';

-- Update the comment on the table to document the new column
COMMENT ON COLUMN availability_calendar.end_date IS 'End date of the availability period. NULL means same as date (single day). Use 9999-12-31 for open-ended availability.';

-- Add constraint: end_date must be >= date if both are specified
ALTER TABLE availability_calendar
ADD CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= date);
