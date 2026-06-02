-- Ensure authenticated users can manage guests belonging to their property.
-- This migration recreates guests RLS policies using the users.property_id mapping.

BEGIN;

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guests_select_same_property ON public.guests;
DROP POLICY IF EXISTS guests_insert_same_property ON public.guests;
DROP POLICY IF EXISTS guests_update_same_property ON public.guests;
DROP POLICY IF EXISTS guests_delete_same_property ON public.guests;

CREATE OR REPLACE FUNCTION public.can_access_guest_property(target_property_id text)
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

GRANT EXECUTE ON FUNCTION public.can_access_guest_property(text) TO authenticated;

CREATE POLICY guests_select_same_property
ON public.guests
FOR SELECT
TO authenticated
USING (
  public.can_access_guest_property(guests.property_id::text)
);

CREATE POLICY guests_insert_same_property
ON public.guests
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_guest_property(guests.property_id::text)
);

CREATE POLICY guests_update_same_property
ON public.guests
FOR UPDATE
TO authenticated
USING (
  public.can_access_guest_property(guests.property_id::text)
)
WITH CHECK (
  public.can_access_guest_property(guests.property_id::text)
);

CREATE POLICY guests_delete_same_property
ON public.guests
FOR DELETE
TO authenticated
USING (
  public.can_access_guest_property(guests.property_id::text)
);

COMMIT;
