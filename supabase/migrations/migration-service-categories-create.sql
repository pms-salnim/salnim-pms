-- Migration: Create service_categories table
-- Date: 2026-04-09
-- Purpose: Store service categories and subcategories

CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id TEXT REFERENCES service_categories(id) ON DELETE CASCADE,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, parent_id, name)
);

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_service_categories_property_id ON service_categories(property_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_parent_id ON service_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_is_active ON service_categories(is_active);

-- Enable RLS on service_categories
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for service_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_categories' 
    AND policyname = 'service_categories_rls_select'
  ) THEN
    CREATE POLICY service_categories_rls_select ON service_categories
      FOR SELECT
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_categories' 
    AND policyname = 'service_categories_rls_insert'
  ) THEN
    CREATE POLICY service_categories_rls_insert ON service_categories
      FOR INSERT
      WITH CHECK (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_categories' 
    AND policyname = 'service_categories_rls_update'
  ) THEN
    CREATE POLICY service_categories_rls_update ON service_categories
      FOR UPDATE
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_categories' 
    AND policyname = 'service_categories_rls_delete'
  ) THEN
    CREATE POLICY service_categories_rls_delete ON service_categories
      FOR DELETE
      USING (
        property_id IN (
          SELECT id FROM properties 
          WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;
