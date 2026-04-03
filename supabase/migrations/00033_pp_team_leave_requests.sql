-- PP (team lead): read leave_request approvals submitted by DT / Driver-Rigger on supervised teams
-- (same rules as fts_pp_supervises_team_row: post_processor on team or PP role + matching region & project).

CREATE OR REPLACE FUNCTION public.fts_pp_can_select_leave_approval(
  p_requester_id uuid,
  p_approval_type public.approval_type
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p_approval_type = 'leave_request'::public.approval_type
    AND public.fts_current_employee_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM auth.users au
      INNER JOIN public.employees e
        ON au.email IS NOT NULL
        AND e.email IS NOT NULL
        AND lower(trim(au.email::text)) = lower(trim(e.email::text))
      INNER JOIN public.teams t
        ON (t.dt_employee_id = e.id OR t.driver_rigger_employee_id = e.id)
      WHERE au.id = p_requester_id
        AND public.fts_pp_supervises_team_row(t.region_id, t.project_id, t.post_processor_employee_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.fts_pp_can_select_leave_approval(uuid, public.approval_type) TO authenticated, service_role;

DROP POLICY IF EXISTS approvals_select ON public.approvals;
CREATE POLICY approvals_select ON public.approvals FOR SELECT USING (
  public.fts_is_super_user() = true
  OR public.fts_is_super_or_has_permission('approvals.view') = true
  OR requester_id = auth.uid()
  OR (region_id IS NOT NULL AND public.fts_is_pm_of_region(region_id) = true)
  OR public.fts_pp_can_select_leave_approval(requester_id, approval_type)
);
