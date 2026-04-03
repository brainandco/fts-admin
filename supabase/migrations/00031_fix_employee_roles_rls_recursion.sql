-- Break infinite recursion between employees and employee_roles RLS policies:
-- employee_roles policies used EXISTS(SELECT ... FROM employees ...), while employees
-- policies (QC) used EXISTS(SELECT ... FROM employee_roles ...).

CREATE OR REPLACE FUNCTION public.fts_internal_employee_region_id(emp_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT region_id FROM public.employees WHERE id = emp_id;
$$;

CREATE OR REPLACE FUNCTION public.fts_internal_employee_has_role(emp_id uuid, role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_roles er
    WHERE er.employee_id = emp_id AND er.role = role_name
  );
$$;

GRANT EXECUTE ON FUNCTION public.fts_internal_employee_region_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fts_internal_employee_has_role(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS employee_roles_select ON public.employee_roles;
CREATE POLICY employee_roles_select ON public.employee_roles FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
  OR (
    public.fts_current_user_region_id() IS NOT NULL
    AND public.fts_internal_employee_region_id(employee_roles.employee_id) = public.fts_current_user_region_id()
  )
);

DROP POLICY IF EXISTS employee_roles_all ON public.employee_roles;
CREATE POLICY employee_roles_all ON public.employee_roles FOR ALL USING (
  public.fts_is_super_user() = true
  OR public.fts_is_super_or_has_permission('users.create') = true
  OR public.fts_is_super_or_has_permission('users.edit') = true
  OR (
    public.fts_current_user_region_id() IS NOT NULL
    AND public.fts_internal_employee_region_id(employee_roles.employee_id) = public.fts_current_user_region_id()
  )
);

DROP POLICY IF EXISTS employees_select_same_region_for_qc ON public.employees;
CREATE POLICY employees_select_same_region_for_qc ON public.employees FOR SELECT
  USING (
    public.fts_current_employee_id() IS NOT NULL
    AND public.fts_internal_employee_has_role(public.fts_current_employee_id(), 'QC')
    AND region_id = public.fts_current_employee_region_id()
    AND id != public.fts_current_employee_id()
    AND NOT public.fts_internal_employee_has_role(id, 'QC')
  );

DROP POLICY IF EXISTS assets_update_qc_reassign ON public.assets;
CREATE POLICY assets_update_qc_reassign ON public.assets FOR UPDATE
  USING (
    assigned_to_employee_id = public.fts_current_employee_id()
    AND public.fts_internal_employee_has_role(public.fts_current_employee_id(), 'QC')
  );

DROP POLICY IF EXISTS asset_assignment_history_insert_qc ON public.asset_assignment_history;
CREATE POLICY asset_assignment_history_insert_qc ON public.asset_assignment_history FOR INSERT
  WITH CHECK (
    public.fts_current_employee_id() IS NOT NULL
    AND public.fts_internal_employee_has_role(public.fts_current_employee_id(), 'QC')
    AND asset_id IN (SELECT id FROM public.assets WHERE assigned_to_employee_id = public.fts_current_employee_id())
  );
