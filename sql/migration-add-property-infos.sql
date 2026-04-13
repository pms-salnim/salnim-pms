-- Migration: Add property infos columns to properties table
-- This adds all the missing columns needed for property info management

-- Add property type and basic info columns
ALTER TABLE IF EXISTS properties
ADD COLUMN IF NOT EXISTS type VARCHAR(100),
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS year_established INT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS star_rating DECIMAL(3, 1),
ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),
ADD COLUMN IF NOT EXISTS state_province VARCHAR(100),
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS google_maps_link TEXT,
ADD COLUMN IF NOT EXISTS legal_business_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS property_style VARCHAR(100);

-- Add property specifications columns
ALTER TABLE IF EXISTS properties
ADD COLUMN IF NOT EXISTS total_rooms INT,
ADD COLUMN IF NOT EXISTS max_guest_capacity INT,
ADD COLUMN IF NOT EXISTS property_size_square_feet INT,
ADD COLUMN IF NOT EXISTS number_floors INT,
ADD COLUMN IF NOT EXISTS number_buildings INT;

-- Add European legal information columns
ALTER TABLE IF EXISTS properties
ADD COLUMN IF NOT EXISTS european_company_reg_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS european_vat_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS european_trade_reg_entry VARCHAR(100),
ADD COLUMN IF NOT EXISTS european_chamber_registration VARCHAR(100),
ADD COLUMN IF NOT EXISTS european_tax_registration VARCHAR(100);

-- Add Moroccan legal information columns
ALTER TABLE IF EXISTS properties
ADD COLUMN IF NOT EXISTS moroccan_legal_company_form VARCHAR(100),
ADD COLUMN IF NOT EXISTS moroccan_rc VARCHAR(100),
ADD COLUMN IF NOT EXISTS moroccan_if VARCHAR(100),
ADD COLUMN IF NOT EXISTS moroccan_ice VARCHAR(100),
ADD COLUMN IF NOT EXISTS moroccan_cnss VARCHAR(100),
ADD COLUMN IF NOT EXISTS moroccan_patent_number VARCHAR(100);

-- Add USA legal information columns
ALTER TABLE IF EXISTS properties
ADD COLUMN IF NOT EXISTS usa_ein VARCHAR(100),
ADD COLUMN IF NOT EXISTS usa_state_license_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS usa_secretary_of_state_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS usa_federal_tax_id VARCHAR(100);

-- Add notification and preference settings columns
ALTER TABLE IF EXISTS properties
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preference_settings JSONB DEFAULT '{}';

-- Verify columns were added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'properties' 
ORDER BY ordinal_position;
