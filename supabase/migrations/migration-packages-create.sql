-- Migration: Create packages table for Supabase
-- Purpose: Store package configurations with comprehensive pricing and availability options

BEGIN;

-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Basics
  name VARCHAR(255) NOT NULL,
  short_description TEXT,
  full_description TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  package_category VARCHAR(50) CHECK (package_category IN ('stay_package', 'experience_package', 'seasonal_offer', 'custom')),
  
  -- Room Rules
  applicable_room_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  minimum_nights INT DEFAULT 1,
  maximum_nights INT,
  
  -- Meal Plans
  included_meal_plan_id TEXT REFERENCES meal_plans(id) ON DELETE SET NULL,
  allow_meal_plan_upgrade BOOLEAN DEFAULT FALSE,
  
  -- Services & Experiences (JSONB array: [{serviceId, quantity, mandatory}])
  included_services JSONB DEFAULT '[]'::JSONB,
  
  -- Pricing
  pricing_type VARCHAR(50) CHECK (pricing_type IN ('fixed_price', 'discounted_bundle', 'per_night_surcharge')),
  package_price NUMERIC(10, 2),
  discount_display VARCHAR(100),
  pricing_logic VARCHAR(50) CHECK (pricing_logic IN ('per_guest', 'per_room')),
  
  -- Availability & Booking Rules
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  blackout_dates TEXT[] DEFAULT ARRAY[]::TEXT[],
  advance_booking_days INT,
  cancellation_policy TEXT,
  stackable_with_offers BOOLEAN DEFAULT FALSE,
  
  -- Visibility & Channels
  visible_on_booking BOOLEAN DEFAULT TRUE,
  visible_in_guest_portal BOOLEAN DEFAULT TRUE,
  auto_apply BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) CHECK (status IN ('Draft', 'Active', 'Archived')) DEFAULT 'Draft',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_packages_property_id ON packages(property_id);
CREATE INDEX IF NOT EXISTS idx_packages_package_category ON packages(package_category);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_pricing_type ON packages(pricing_type);
CREATE INDEX IF NOT EXISTS idx_packages_featured ON packages(featured);
CREATE INDEX IF NOT EXISTS idx_packages_visible_on_booking ON packages(visible_on_booking);
CREATE INDEX IF NOT EXISTS idx_packages_visible_in_guest_portal ON packages(visible_in_guest_portal);

-- Add comments for documentation
COMMENT ON TABLE packages IS 'Comprehensive package configurations with pricing, meal plans, services, and availability rules';
COMMENT ON COLUMN packages.applicable_room_types IS 'Array of room type IDs this package applies to';
COMMENT ON COLUMN packages.included_services IS 'JSONB array of {serviceId, quantity, mandatory} objects';
COMMENT ON COLUMN packages.images IS 'Array of image URLs for the package';
COMMENT ON COLUMN packages.blackout_dates IS 'Array of date strings when package is not available';
COMMENT ON COLUMN packages.pricing_logic IS 'Whether pricing is per guest or per room';

COMMIT;
