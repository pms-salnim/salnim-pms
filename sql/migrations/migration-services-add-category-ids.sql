-- Migration: Add category_id and subcategory_id columns to services table
-- Purpose: Store category hierarchy references for better data structure and readability

BEGIN;

-- Add new columns to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES service_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subcategory_id TEXT REFERENCES service_categories(id) ON DELETE SET NULL;

-- Create indexes for foreign key columns for faster queries
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_subcategory_id ON services(subcategory_id);

-- Create indexes for combined filtering (category + subcategory)
CREATE INDEX IF NOT EXISTS idx_services_category_subcategory ON services(category_id, subcategory_id);

-- Add comment explaining columns
COMMENT ON COLUMN services.category_id IS 'Reference to parent category in service_categories table';
COMMENT ON COLUMN services.subcategory_id IS 'Reference to subcategory (child) in service_categories table';

COMMIT;
