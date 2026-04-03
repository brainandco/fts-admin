-- =============================================================================
-- Fix: "permission denied for table users" when creating employee (or elsewhere)
-- Run this in Supabase Dashboard → SQL Editor.
-- =============================================================================
-- Cause: RLS and RPCs that read auth.users run as a role that has no SELECT on
-- auth.users. This adds a SECURITY DEFINER helper and grants so they can run.
-- =============================================================================

-- 1. RLS policy: match by email from users_profile (avoids reading auth.users)
DROP POLICY IF EXISTS employees_select_own_by_email ON employees;
CREATE POLICY employees_select_own_by_email ON employees FOR SELECT TO authenticated
  USING ((SELECT email FROM public.users_profile WHERE id = auth.uid() LIMIT 1) = employees.email);

-- 2. Helper for other uses (keep in sync with FTS_FULL_DATABASE.sql)
CREATE OR REPLACE FUNCTION public.fts_auth_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Grant so RPCs (assign_regional_pm_role_by_email, etc.) can read auth.users
DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO postgres;
  GRANT SELECT ON auth.users TO postgres;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO supabase_admin;
  GRANT SELECT ON auth.users TO supabase_admin;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- Done. Try creating an employee again from the admin portal.
-- =============================================================================
