-- PP can view teams (and DT/DR assets, SIMs, vehicles) when either:
-- (1) teams.post_processor_employee_id = PP, or
-- (2) PP role and employee.region_id + employee.project_id match team.region_id + team.project_id
--    (no need to set post_processor_employee_id when region/project alignment is enough).

CREATE OR REPLACE FUNCTION public.fts_pp_supervises_team_row(
  p_region_id uuid,
  p_project_id uuid,
  p_post_processor_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.fts_current_employee_id() IS NOT NULL
    AND (
      (p_post_processor_id IS NOT NULL AND p_post_processor_id = public.fts_current_employee_id())
      OR (
        EXISTS (
          SELECT 1 FROM public.employee_roles er
          WHERE er.employee_id = public.fts_current_employee_id() AND er.role = 'PP'
        )
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = public.fts_current_employee_id()
            AND e.region_id IS NOT NULL
            AND e.project_id IS NOT NULL
            AND p_region_id IS NOT NULL
            AND p_project_id IS NOT NULL
            AND e.region_id = p_region_id
            AND e.project_id = p_project_id
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.fts_current_employee_can_select_team_row(
  p_region_id uuid,
  p_project_id uuid,
  p_post_processor_id uuid,
  p_dt_id uuid,
  p_dr_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.fts_current_employee_id() IS NOT NULL
    AND (
      p_dt_id IS NOT NULL AND p_dt_id = public.fts_current_employee_id()
      OR p_dr_id IS NOT NULL AND p_dr_id = public.fts_current_employee_id()
      OR public.fts_pp_supervises_team_row(p_region_id, p_project_id, p_post_processor_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.fts_pp_supervises_team_row(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fts_current_employee_can_select_team_row(uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- Teams: DT / Driver-Rigger / explicit PP on team / PP matched by region+project
DROP POLICY IF EXISTS teams_select_own_employee ON public.teams;
CREATE POLICY teams_select_own_employee ON public.teams FOR SELECT
  USING (
    public.fts_current_employee_can_select_team_row(
      teams.region_id,
      teams.project_id,
      teams.post_processor_employee_id,
      teams.dt_employee_id,
      teams.driver_rigger_employee_id
    )
  );

-- Assets on supervised teams (same logic as 00028 but uses fts_pp_supervises_team_row for region+project match)
DROP POLICY IF EXISTS assets_select_own_employee ON public.assets;
CREATE POLICY assets_select_own_employee ON public.assets FOR SELECT
  USING (
    assigned_to_employee_id = public.fts_current_employee_id()
    OR (
      assigned_to_employee_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
          AND (
            t.dt_employee_id = assets.assigned_to_employee_id
            OR t.driver_rigger_employee_id = assets.assigned_to_employee_id
          )
      )
    )
  );

-- Teammates + DT/DR on PP-supervised teams
DROP POLICY IF EXISTS employees_select_teammates ON public.employees;
CREATE POLICY employees_select_teammates ON public.employees FOR SELECT
  USING (
    id IN (
      SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
      UNION
      SELECT dt_employee_id FROM public.teams t
      WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
        AND t.dt_employee_id IS NOT NULL
      UNION
      SELECT driver_rigger_employee_id FROM public.teams t
      WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
        AND t.driver_rigger_employee_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS employee_roles_select_own ON public.employee_roles;
CREATE POLICY employee_roles_select_own ON public.employee_roles FOR SELECT
  USING (
    employee_id = public.fts_current_employee_id()
    OR employee_id IN (
      SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
      UNION
      SELECT dt_employee_id FROM public.teams t
      WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
        AND t.dt_employee_id IS NOT NULL
      UNION
      SELECT driver_rigger_employee_id FROM public.teams t
      WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
        AND t.driver_rigger_employee_id IS NOT NULL
    )
  );

-- Projects: PP reads project row for own employee.project_id; also teams they supervise (explicit or region+project)
DROP POLICY IF EXISTS projects_select_own_employee ON public.projects;
CREATE POLICY projects_select_own_employee ON public.projects FOR SELECT
  USING (
    id = (SELECT project_id FROM public.employees WHERE id = public.fts_current_employee_id())
    OR id IN (
      SELECT t.project_id FROM public.teams t
      WHERE t.project_id IS NOT NULL
        AND public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
    )
  );

-- Vehicle assignments for DT/DR on supervised teams
DROP POLICY IF EXISTS vehicle_assignments_select_own_employee ON public.vehicle_assignments;
CREATE POLICY vehicle_assignments_select_own_employee ON public.vehicle_assignments FOR SELECT
  USING (
    employee_id = public.fts_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
        AND (
          t.dt_employee_id = vehicle_assignments.employee_id
          OR t.driver_rigger_employee_id = vehicle_assignments.employee_id
        )
    )
  );

-- Vehicles tied to those assignments
DROP POLICY IF EXISTS vehicles_select_own_assigned ON public.vehicles;
CREATE POLICY vehicles_select_own_assigned ON public.vehicles FOR SELECT
  USING (
    id IN (
      SELECT vehicle_id FROM public.vehicle_assignments
      WHERE employee_id = public.fts_current_employee_id()
    )
    OR id IN (
      SELECT va.vehicle_id FROM public.vehicle_assignments va
      INNER JOIN public.teams t ON (
        t.dt_employee_id = va.employee_id OR t.driver_rigger_employee_id = va.employee_id
      )
      WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
    )
  );

-- SIMs assigned to DT/DR on supervised teams
DROP POLICY IF EXISTS sim_cards_select ON public.sim_cards;
CREATE POLICY sim_cards_select ON public.sim_cards
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
    OR (
      assigned_to_employee_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
          AND (
            t.dt_employee_id = sim_cards.assigned_to_employee_id
            OR t.driver_rigger_employee_id = sim_cards.assigned_to_employee_id
          )
      )
    )
  );

DROP POLICY IF EXISTS sim_assignment_history_select ON public.sim_assignment_history;
CREATE POLICY sim_assignment_history_select ON public.sim_assignment_history
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
    OR (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
          AND (
            t.dt_employee_id = sim_assignment_history.to_employee_id
            OR t.driver_rigger_employee_id = sim_assignment_history.to_employee_id
          )
      )
    )
  );
