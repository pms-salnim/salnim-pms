-- Migration: Add missing columns to meal_plan_categories table
-- Purpose: Add icon, display_order, is_active columns to existing table

BEGIN;

-- Add missing columns if they don't exist
ALTER TABLE meal_plan_categories
ADD COLUMN IF NOT EXISTS icon VARCHAR(50),
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_property_id ON meal_plan_categories(property_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_parent_id ON meal_plan_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_is_active ON meal_plan_categories(is_active);

-- Add unique constraint if not exists (may fail if some rows violate it, that's OK)
ALTER TABLE meal_plan_categories
ADD CONSTRAINT unique_meal_plan_categories_per_property UNIQUE(property_id, parent_id, name);

COMMIT;
