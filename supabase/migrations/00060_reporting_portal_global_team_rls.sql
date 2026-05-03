-- Reporting Team: global team supervision for RLS (no home region required).
-- PP with no home region: same global access (legacy PP aligned with reporting portal).
-- PP with region+project set: unchanged (explicit post_processor on team OR region/project match).

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
      OR EXISTS (
        SELECT 1 FROM public.employee_roles er
        WHERE er.employee_id = public.fts_current_employee_id() AND er.role = 'Reporting Team'
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.employee_roles er
          WHERE er.employee_id = public.fts_current_employee_id() AND er.role = 'PP'
        )
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = public.fts_current_employee_id() AND e.region_id IS NULL
        )
      )
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
