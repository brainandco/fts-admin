-- PP (Post Processor): team lead role; teams optionally link one PP. Employee portal RLS extended.

ALTER TABLE public.employee_roles DROP CONSTRAINT IF EXISTS employee_roles_role_check;
ALTER TABLE public.employee_roles ADD CONSTRAINT employee_roles_role_check
  CHECK (role IN ('DT', 'Driver/Rigger', 'QC', 'QA', 'Project Manager', 'Self DT', 'PP'));

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS post_processor_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_post_processor_employee ON public.teams(post_processor_employee_id);

-- Teams: PP can read teams they supervise
DROP POLICY IF EXISTS teams_select_own_employee ON public.teams;
CREATE POLICY teams_select_own_employee ON public.teams FOR SELECT
  USING (
    dt_employee_id = public.fts_current_employee_id()
    OR driver_rigger_employee_id = public.fts_current_employee_id()
    OR post_processor_employee_id = public.fts_current_employee_id()
  );

-- Assets: PP can read tools assigned to DT / Driver-Rigger on their teams
DROP POLICY IF EXISTS assets_select_own_employee ON public.assets;
CREATE POLICY assets_select_own_employee ON public.assets FOR SELECT
  USING (
    assigned_to_employee_id = public.fts_current_employee_id()
    OR (
      assigned_to_employee_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.post_processor_employee_id = public.fts_current_employee_id()
          AND (
            t.dt_employee_id = assets.assigned_to_employee_id
            OR t.driver_rigger_employee_id = assets.assigned_to_employee_id
          )
      )
    )
  );

-- Employees: PP can read DT / Driver-Rigger on assigned teams
DROP POLICY IF EXISTS employees_select_teammates ON public.employees;
CREATE POLICY employees_select_teammates ON public.employees FOR SELECT
  USING (
    id IN (
      SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
      UNION
      SELECT dt_employee_id FROM public.teams WHERE post_processor_employee_id = public.fts_current_employee_id()
        AND dt_employee_id IS NOT NULL
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE post_processor_employee_id = public.fts_current_employee_id()
        AND driver_rigger_employee_id IS NOT NULL
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
      SELECT dt_employee_id FROM public.teams WHERE post_processor_employee_id = public.fts_current_employee_id()
        AND dt_employee_id IS NOT NULL
      UNION
      SELECT driver_rigger_employee_id FROM public.teams WHERE post_processor_employee_id = public.fts_current_employee_id()
        AND driver_rigger_employee_id IS NOT NULL
    )
  );

-- Projects: PP can read formal project rows for teams they supervise
DROP POLICY IF EXISTS projects_select_own_employee ON public.projects;
CREATE POLICY projects_select_own_employee ON public.projects FOR SELECT
  USING (
    id = (SELECT project_id FROM public.employees WHERE id = public.fts_current_employee_id())
    OR id IN (
      SELECT t.project_id FROM public.teams t
      WHERE t.post_processor_employee_id = public.fts_current_employee_id()
        AND t.project_id IS NOT NULL
    )
  );
