-- Migration: Add promotion_type column to promotions table
-- Date: 2026-04-09
-- Purpose: Store whether promotion is 'automatic' or 'coupon' type

ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS promotion_type VARCHAR(50) DEFAULT 'automatic' CHECK (promotion_type IN ('automatic', 'coupon'));

-- Update existing promotions based on whether they have a coupon code
UPDATE promotions SET promotion_type = CASE 
  WHEN code IS NOT NULL AND code != '' THEN 'coupon'
  ELSE 'automatic'
END;

-- Make column NOT NULL
ALTER TABLE promotions 
ALTER COLUMN promotion_type SET NOT NULL;

-- Add comment
COMMENT ON COLUMN promotions.promotion_type IS 'Type of promotion: automatic (always applied) or coupon (requires code)';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_promotions_promotion_type ON promotions(promotion_type);
