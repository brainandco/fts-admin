-- Remove Project–Region PM entirely. PM is an employee role only; region and project are set on the employee.

-- 1. Neuter helpers so RLS no longer grants access via "user is PM of region"
CREATE OR REPLACE FUNCTION public.fts_current_user_region_id()
RETURNS UUID AS $$
  SELECT NULL::UUID;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_is_pm_of_region(rid UUID)
RETURNS BOOLEAN AS $$
  SELECT false;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop policies that reference the tables we are dropping
DROP POLICY IF EXISTS region_pm_assignments_select ON region_pm_assignments;
DROP POLICY IF EXISTS region_pm_assignments_all ON region_pm_assignments;
DROP POLICY IF EXISTS project_region_pm_select ON project_region_pm;
DROP POLICY IF EXISTS project_region_pm_all ON project_region_pm;

-- 3. Drop tables
DROP TABLE IF EXISTS project_region_pm;
DROP TABLE IF EXISTS region_pm_assignments;

-- 4. Drop RPCs that managed user-based regional PM
DROP FUNCTION IF EXISTS public.assign_regional_pm_role_by_email(TEXT);
DROP FUNCTION IF EXISTS public.remove_regional_pm_role_by_email(TEXT);
DROP FUNCTION IF EXISTS public.set_project_region_pm(UUID, UUID, TEXT);
