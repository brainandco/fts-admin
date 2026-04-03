-- Employee portal: allow authenticated employee to read own region, assets, vehicles, teams, teammates.
-- Employee is identified by matching employees.email to the auth user's email (via users_profile).

-- Helper: current user's employee id (null if not an employee or no matching row)
CREATE OR REPLACE FUNCTION public.fts_current_employee_id()
RETURNS UUID AS $$
  SELECT e.id FROM public.employees e
  WHERE e.email = (SELECT email FROM public.users_profile WHERE id = auth.uid() LIMIT 1)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Regions: employee can read their own region only
DROP POLICY IF EXISTS regions_select_own_employee ON regions;
CREATE POLICY regions_select_own_employee ON regions FOR SELECT
  USING (id = (SELECT region_id FROM public.employees WHERE id = public.fts_current_employee_id()));

-- Assets: employee can read assets assigned to them
DROP POLICY IF EXISTS assets_select_own_employee ON assets;
CREATE POLICY assets_select_own_employee ON assets FOR SELECT
  USING (assigned_to_employee_id = public.fts_current_employee_id());

-- Vehicle assignments: employee can read their own assignments
DROP POLICY IF EXISTS vehicle_assignments_select_own_employee ON vehicle_assignments;
CREATE POLICY vehicle_assignments_select_own_employee ON vehicle_assignments FOR SELECT
  USING (employee_id = public.fts_current_employee_id());

-- Vehicles: employee can read vehicles they are assigned to
DROP POLICY IF EXISTS vehicles_select_own_assigned ON vehicles;
CREATE POLICY vehicles_select_own_assigned ON vehicles FOR SELECT
  USING (
    id IN (
      SELECT vehicle_id FROM public.vehicle_assignments
      WHERE employee_id = public.fts_current_employee_id()
    )
  );

-- Teams: employee can read teams where they are DT or Driver/Rigger
DROP POLICY IF EXISTS teams_select_own_employee ON teams;
CREATE POLICY teams_select_own_employee ON teams FOR SELECT
  USING (
    dt_employee_id = public.fts_current_employee_id()
    OR driver_rigger_employee_id = public.fts_current_employee_id()
  );

-- Employees: allow reading teammate(s) - same team, other slot (name/role only for context)
-- We already have employees_select_own_by_email. Add policy to read employees who are in a team with current employee.
DROP POLICY IF EXISTS employees_select_teammates ON employees;
CREATE POLICY employees_select_teammates ON employees FOR SELECT
  USING (
    id IN (
      SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
    )
  );

-- Employee roles: employee can read own roles and teammate roles (for display)
DROP POLICY IF EXISTS employee_roles_select_own ON employee_roles;
CREATE POLICY employee_roles_select_own ON employee_roles FOR SELECT
  USING (
    employee_id = public.fts_current_employee_id()
    OR employee_id IN (
      SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
    )
  );

-- Projects: employee can read their project (for team context)
DROP POLICY IF EXISTS projects_select_own_employee ON projects;
CREATE POLICY projects_select_own_employee ON projects FOR SELECT
  USING (id = (SELECT project_id FROM public.employees WHERE id = public.fts_current_employee_id()));
