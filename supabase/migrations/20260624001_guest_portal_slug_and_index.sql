-- Add property slug support required by guest portal public API
-- and add a composite index for guest conversation lookups.

BEGIN;

-- 1) Add slug column if missing
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2) Backfill slug from property name where null/empty
WITH base AS (
  SELECT
    id,
    COALESCE(NULLIF(slug, ''), '') AS current_slug,
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      )
    ) AS raw_slug
  FROM public.properties
), prepared AS (
  SELECT
    id,
    CASE
      WHEN raw_slug IS NULL OR raw_slug = '' THEN 'property'
      ELSE raw_slug
    END AS slug_base,
    current_slug
  FROM base
), deduped AS (
  SELECT
    id,
    slug_base,
    ROW_NUMBER() OVER (PARTITION BY slug_base ORDER BY id) AS rn,
    current_slug
  FROM prepared
)
UPDATE public.properties p
SET slug = CASE
  WHEN d.rn = 1 THEN d.slug_base
  ELSE d.slug_base || '-' || d.rn::TEXT
END
FROM deduped d
WHERE p.id = d.id
  AND (p.slug IS NULL OR p.slug = '');

-- 3) Ensure uniqueness for populated slugs
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_slug_unique
ON public.properties(slug)
WHERE slug IS NOT NULL;

-- 4) Composite index for guest portal conversations query pattern
CREATE INDEX IF NOT EXISTS idx_gp_conversations_property_reservation_active_updated
ON public.guest_portal_conversations(property_id, reservation_id, is_active, updated_at DESC);

COMMIT;
