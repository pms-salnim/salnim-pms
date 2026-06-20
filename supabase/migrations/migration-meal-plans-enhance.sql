-- Migration: Enhance meal_plans table with comprehensive fields
-- Purpose: Add all required fields for full meal plan functionality

BEGIN;

-- Add new columns to meal_plans table
ALTER TABLE meal_plans 
ADD COLUMN IF NOT EXISTS short_description VARCHAR(500),
ADD COLUMN IF NOT EXISTS full_description TEXT,
ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES meal_plan_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subcategory_id TEXT REFERENCES meal_plan_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS meal_plan_type VARCHAR(50) CHECK (meal_plan_type IN ('breakfast', 'half-board', 'full-board', 'all-inclusive', 'custom')),
ADD COLUMN IF NOT EXISTS included_meals JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(50) CHECK (pricing_model IN ('per-guest-night', 'per-room-night', 'flat-rate')),
ADD COLUMN IF NOT EXISTS base_price DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS adult_price DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS child_price DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS infant_price DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS infant_free BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_age_pricing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS available_dates_start DATE,
ADD COLUMN IF NOT EXISTS available_dates_end DATE,
ADD COLUMN IF NOT EXISTS minimum_stay INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS blackout_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
ADD COLUMN IF NOT EXISTS upgrade_allowed BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS applicable_room_types JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS applicable_rate_plans JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS visible_on_booking BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_in_guest_portal BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Draft', 'Archived'));

-- Create indexes for filtering and searching
CREATE INDEX IF NOT EXISTS idx_meal_plans_property_id ON meal_plans(property_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_category_id ON meal_plans(category_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_subcategory_id ON meal_plans(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON meal_plans(status);
CREATE INDEX IF NOT EXISTS idx_meal_plans_visible_on_booking ON meal_plans(visible_on_booking);
CREATE INDEX IF NOT EXISTS idx_meal_plans_visible_in_guest_portal ON meal_plans(visible_in_guest_portal);
CREATE INDEX IF NOT EXISTS idx_meal_plans_meal_plan_type ON meal_plans(meal_plan_type);
CREATE INDEX IF NOT EXISTS idx_meal_plans_pricing_model ON meal_plans(pricing_model);

-- Add comments for documentation
COMMENT ON COLUMN meal_plans.meal_plan_type IS 'Type of meal plan: breakfast, half-board, full-board, all-inclusive, custom';
COMMENT ON COLUMN meal_plans.included_meals IS 'Array of included meals: breakfast, lunch, dinner, snacks, drinks';
COMMENT ON COLUMN meal_plans.pricing_model IS 'Pricing calculation method: per-guest-night, per-room-night, flat-rate';
COMMENT ON COLUMN meal_plans.applicable_room_types IS 'Array of room type IDs this meal plan applies to';
COMMENT ON COLUMN meal_plans.applicable_rate_plans IS 'JSON object mapping room_type_id to array of rate plan IDs';
COMMENT ON COLUMN meal_plans.blackout_dates IS 'Array of dates when this meal plan is not available';

COMMIT;
