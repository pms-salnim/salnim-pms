-- Migration: Add name column to promotions table
-- Date: 2026-04-09
-- Purpose: Store promotion display name separately from coupon code

ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Populate existing promotions with their code as name if null
UPDATE promotions SET name = code WHERE name IS NULL;

-- Make name NOT NULL with default
ALTER TABLE promotions 
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN name SET DEFAULT '';

-- Add comment to explain the column
COMMENT ON COLUMN promotions.name IS 'Display name for the promotion, separate from the unique code';
