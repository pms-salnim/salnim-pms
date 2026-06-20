-- =====================================================
-- MIGRATION: Enhance Meal Plans Schema
-- PURPOSE: Add comprehensive support for meal plan management
-- CREATED: 2025-12-30
-- =====================================================

-- =====================================================
-- 1. CREATE MEAL PLAN CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS meal_plan_categories (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id TEXT REFERENCES meal_plan_categories(id) ON DELETE CASCADE,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, parent_id, name)
);

-- Index for meal plan category queries
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_property_id ON meal_plan_categories(property_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_parent_id ON meal_plan_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_categories_is_active ON meal_plan_categories(is_active);

-- =====================================================
-- 2. ENHANCE MEAL PLANS TABLE
-- =====================================================
-- Add new columns to meal_plans table

-- Short and full descriptions
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS full_description TEXT;

-- Category hierarchy
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES meal_plan_categories(id) ON DELETE SET NULL;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS subcategory_id TEXT REFERENCES meal_plan_categories(id) ON DELETE SET NULL;

-- Meal plan type
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_plan_type VARCHAR(50) CHECK (meal_plan_type IN ('breakfast', 'half-board', 'full-board', 'all-inclusive', 'custom'));

-- Convert meals_included to JSONB (drop and recreate to avoid conversion issues)
DO $$ BEGIN
  -- Check if meals_included exists and is not already JSONB
  IF EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meal_plans' 
    AND column_name = 'meals_included'
    AND data_type != 'jsonb'
  ) THEN
    -- Drop the old column and create as JSONB
    ALTER TABLE meal_plans DROP COLUMN meals_included;
  END IF;
END $$;

-- Create meals_included as JSONB if it doesn't exist
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meals_included JSONB DEFAULT '[]'::jsonb;

-- Pricing Model and variants
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(50) CHECK (pricing_model IN ('per-guest-night', 'per-room-night', 'flat-rate'));

-- Base pricing
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS base_price DECIMAL(15, 2);

-- Age-based pricing
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS adult_price DECIMAL(15, 2);
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS child_price DECIMAL(15, 2);
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS infant_price DECIMAL(15, 2);
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS infant_free BOOLEAN DEFAULT FALSE;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS enable_age_pricing BOOLEAN DEFAULT FALSE;

-- Availability
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS available_start_date DATE;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS available_end_date DATE;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS minimum_stay INT DEFAULT 1;

-- Blackout dates (JSONB array of date strings)
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS blackout_dates JSONB DEFAULT '[]'::jsonb;

-- Policies
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS upgrade_allowed BOOLEAN DEFAULT FALSE;

-- Room and rate plan applicability
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS applicable_room_types JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS applicable_rate_plans JSONB DEFAULT '{}'::jsonb;

-- Default and visibility
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS booking_engine BOOLEAN DEFAULT FALSE;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS guest_portal BOOLEAN DEFAULT FALSE;

-- Status (ensure it's TEXT and can handle all values)
DO $$ BEGIN
  ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Active', 'Draft', 'Archived'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- =====================================================
-- 3. ADD PERFORMANCE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_meal_plans_property_id ON meal_plans(property_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON meal_plans(status);
CREATE INDEX IF NOT EXISTS idx_meal_plans_meal_plan_type ON meal_plans(meal_plan_type);
CREATE INDEX IF NOT EXISTS idx_meal_plans_category_id ON meal_plans(category_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_subcategory_id ON meal_plans(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_property_status ON meal_plans(property_id, status);
CREATE INDEX IF NOT EXISTS idx_meal_plans_property_meal_type ON meal_plans(property_id, meal_plan_type);
CREATE INDEX IF NOT EXISTS idx_meal_plans_is_active ON meal_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_meal_plans_is_default ON meal_plans(is_default);
CREATE INDEX IF NOT EXISTS idx_meal_plans_booking_engine ON meal_plans(booking_engine);
CREATE INDEX IF NOT EXISTS idx_meal_plans_guest_portal ON meal_plans(guest_portal);
CREATE INDEX IF NOT EXISTS idx_meal_plans_applicable_room_types ON meal_plans USING GIN (applicable_room_types);

-- =====================================================
-- 4. ADD TRIGGER FOR AUTOMATIC TIMESTAMPS
-- =====================================================
DROP TRIGGER IF EXISTS meal_plan_categories_update_timestamp ON meal_plan_categories;
CREATE TRIGGER meal_plan_categories_update_timestamp 
BEFORE UPDATE ON meal_plan_categories 
FOR EACH ROW 
EXECUTE FUNCTION update_timestamp();
