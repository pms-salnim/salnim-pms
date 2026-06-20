-- Create reviews table for reputation management and guest portal reviews
-- This replaces the Firestore reviews collection with Supabase/Postgres.

BEGIN;

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'guest_portal',
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  reservation_id TEXT,
  reservation_number TEXT,
  ratings JSONB NOT NULL DEFAULT '{"overall": 0}'::jsonb,
  review_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'responded')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_id TEXT,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_property_id ON public.reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reservation_id ON public.reviews(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_property_status_created ON public.reviews(property_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_update_timestamp ON public.reviews;
CREATE TRIGGER reviews_update_timestamp
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_reviews_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_review_property(target_property_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_text text := auth.uid()::text;
  has_access boolean := false;
BEGIN
  IF uid_text IS NULL OR target_property_id IS NULL THEN
    RETURN false;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = $1
        AND u.property_id::text = $2
    )'
    INTO has_access
    USING uid_text, target_property_id;

    IF has_access THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regclass('public.team_members') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id::text = $1
          AND tm.property_id::text = $2
      )'
      INTO has_access
      USING uid_text, target_property_id;
      IF has_access THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    BEGIN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.auth_user_id::text = $1
          AND tm.property_id::text = $2
      )'
      INTO has_access
      USING uid_text, target_property_id;
      IF has_access THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    BEGIN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id::text = $1
          AND tm.property_id::text = $2
      )'
      INTO has_access
      USING uid_text, target_property_id;
      IF has_access THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_review_property(text) TO authenticated;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_public_select ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_by_property_staff ON public.reviews;
DROP POLICY IF EXISTS reviews_update_by_property_staff ON public.reviews;
DROP POLICY IF EXISTS reviews_delete_by_property_staff ON public.reviews;

-- Public read access is required for the guest portal reviews tab.
CREATE POLICY reviews_public_select
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);

-- Writes and moderation are restricted to authenticated users who can access the property.
CREATE POLICY reviews_insert_by_property_staff
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_review_property(property_id::text)
);

CREATE POLICY reviews_update_by_property_staff
ON public.reviews
FOR UPDATE
TO authenticated
USING (
  public.can_access_review_property(property_id::text)
)
WITH CHECK (
  public.can_access_review_property(property_id::text)
);

CREATE POLICY reviews_delete_by_property_staff
ON public.reviews
FOR DELETE
TO authenticated
USING (
  public.can_access_review_property(property_id::text)
);

COMMIT;
