-- Migration: Disable RLS for meal_plan_categories and meal_plans
-- Purpose: Allow anon key access with server-side security from API

BEGIN;

-- Disable RLS on meal_plan_categories (security handled at API level)
ALTER TABLE meal_plan_categories DISABLE ROW LEVEL SECURITY;

-- Disable RLS on meal_plans (security handled at API level)
ALTER TABLE meal_plans DISABLE ROW LEVEL SECURITY;

COMMIT;
