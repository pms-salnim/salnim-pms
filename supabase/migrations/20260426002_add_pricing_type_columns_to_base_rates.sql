-- Migration: Add pricing type columns to base_rates table
-- Date: April 26, 2026
-- Description: Adds columns to track whether extra occupancy charges and discounts are fixed amount or percentage

-- Add new columns to base_rates table
ALTER TABLE base_rates ADD COLUMN IF NOT EXISTS extra_adult_price_type VARCHAR(20) DEFAULT 'fixed';
ALTER TABLE base_rates ADD COLUMN IF NOT EXISTS extra_child_price_type VARCHAR(20) DEFAULT 'fixed';
ALTER TABLE base_rates ADD COLUMN IF NOT EXISTS single_use_discount_type VARCHAR(20) DEFAULT 'percentage';

-- Add check constraints to ensure valid values
ALTER TABLE base_rates ADD CONSTRAINT check_extra_adult_price_type 
  CHECK (extra_adult_price_type IN ('fixed', 'percentage'));
  
ALTER TABLE base_rates ADD CONSTRAINT check_extra_child_price_type 
  CHECK (extra_child_price_type IN ('fixed', 'percentage'));
  
ALTER TABLE base_rates ADD CONSTRAINT check_single_use_discount_type 
  CHECK (single_use_discount_type IN ('fixed', 'percentage'));

-- Add comments to the columns
COMMENT ON COLUMN base_rates.extra_adult_price_type IS 'Type of extra adult charge: fixed amount or percentage of base price';
COMMENT ON COLUMN base_rates.extra_child_price_type IS 'Type of extra child charge: fixed amount or percentage of base price';
COMMENT ON COLUMN base_rates.single_use_discount_type IS 'Type of single-occupancy discount: fixed amount or percentage of final price';
