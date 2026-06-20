-- Migration: Create meal_plan_categories table with hierarchy support
-- Purpose: Store meal plan categories with parent-child relationships

BEGIN;

-- Create meal_plan_categories table
CREATE TABLE IF NOT EXISTS meal_plan_categories (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id TEXT REFERENCES meal_plan_categories(id) ON DELETE CASCADE,
  description TEXT,
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, parent_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_property_id ON meal_plan_categories(property_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_parent_id ON meal_plan_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_is_active ON meal_plan_categories(is_active);

-- Add comments
COMMENT ON TABLE meal_plan_categories IS 'Hierarchical categories for organizing meal plans';
COMMENT ON COLUMN meal_plan_categories.parent_id IS 'Self-reference for parent-child hierarchy';
COMMENT ON COLUMN meal_plan_categories.icon IS 'Optional icon name for UI display';

COMMIT;
