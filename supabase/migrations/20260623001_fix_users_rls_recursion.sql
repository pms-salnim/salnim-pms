-- Fix recursive RLS policies on public.users.
-- The previous policies queried public.users from inside users policies,
-- which can trigger PostgreSQL error 42P17 (infinite recursion detected in policy).

BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on public.users so this migration is idempotent
-- and resilient to prior policy name changes.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', policy_row.policyname);
  END LOOP;
END $$;

-- Returns true if the current authenticated user belongs to target_property_id.
-- SECURITY DEFINER avoids RLS recursion when checking membership in public.users.
CREATE OR REPLACE FUNCTION public.can_access_property_members(target_property_id uuid)
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

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id::text = uid_text
      AND u.property_id = target_property_id
  )
  INTO has_access;

  IF has_access THEN
    RETURN true;
  END IF;

  IF to_regclass('public.team_members') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id::text = $1
          AND tm.property_id::text = $2
      )'
      INTO has_access
      USING uid_text, target_property_id::text;

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
      USING uid_text, target_property_id::text;

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
      USING uid_text, target_property_id::text;

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

-- Returns true if the current authenticated user can manage users for target_property_id.
CREATE OR REPLACE FUNCTION public.can_manage_property_users(target_property_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_text text := auth.uid()::text;
  can_manage boolean := false;
BEGIN
  IF uid_text IS NULL OR target_property_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id::text = uid_text
      AND u.property_id = target_property_id
      AND lower(coalesce(u.role, '')) IN ('owner', 'admin', 'manager')
  )
  INTO can_manage;

  IF can_manage THEN
    RETURN true;
  END IF;

  IF to_regclass('public.team_members') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.id::text = $1
          AND tm.property_id::text = $2
          AND lower(coalesce(tm.role, '''')) IN (''owner'', ''admin'', ''manager'')
      )'
      INTO can_manage
      USING uid_text, target_property_id::text;

      IF can_manage THEN
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
          AND lower(coalesce(tm.role, '''')) IN (''owner'', ''admin'', ''manager'')
      )'
      INTO can_manage
      USING uid_text, target_property_id::text;

      IF can_manage THEN
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
          AND lower(coalesce(tm.role, '''')) IN (''owner'', ''admin'', ''manager'')
      )'
      INTO can_manage
      USING uid_text, target_property_id::text;

      IF can_manage THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_property_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_property_users(uuid) TO authenticated;

-- SELECT: users can read their own profile and other users in the same property.
CREATE POLICY users_select_safe
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.can_access_property_members(property_id)
);

-- INSERT: allow own profile insert, or property managers adding users in their property.
CREATE POLICY users_insert_safe
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  OR public.can_manage_property_users(property_id)
);

-- UPDATE: allow own profile update, or property managers updating users in their property.
CREATE POLICY users_update_safe
ON public.users
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.can_manage_property_users(property_id)
)
WITH CHECK (
  id = auth.uid()
  OR public.can_manage_property_users(property_id)
);

-- DELETE: only property managers can delete users from their property.
CREATE POLICY users_delete_safe
ON public.users
FOR DELETE
TO authenticated
USING (
  public.can_manage_property_users(property_id)
);

COMMIT;
