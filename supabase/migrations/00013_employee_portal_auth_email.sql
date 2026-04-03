-- Employee portal: allow employee to see own row by auth email (not users_profile).
-- Fixes "No active employee account" when employee exists and is ACTIVE but has no/different users_profile.

CREATE OR REPLACE FUNCTION public.fts_auth_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Resolve current employee by auth email (so portal works even without users_profile row for employee)
CREATE OR REPLACE FUNCTION public.fts_current_employee_id()
RETURNS UUID AS $$
  SELECT e.id FROM public.employees e
  WHERE public.fts_auth_user_email() IS NOT NULL
    AND LOWER(TRIM(COALESCE(e.email, ''))) = LOWER(TRIM(public.fts_auth_user_email()))
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS employees_select_own_by_email ON employees;
CREATE POLICY employees_select_own_by_email ON employees FOR SELECT TO authenticated
  USING (
    public.fts_auth_user_email() IS NOT NULL
    AND LOWER(TRIM(COALESCE(employees.email, ''))) = LOWER(TRIM(public.fts_auth_user_email()))
  );
