-- QC in employee portal: see same-region employees (excluding other QCs), reassign assets to them.
-- Use a SECURITY DEFINER helper to avoid querying employees inside employees policy (infinite recursion).

CREATE OR REPLACE FUNCTION public.fts_current_employee_region_id()
RETURNS UUID AS $$
  SELECT e.region_id FROM public.employees e
  WHERE e.id = public.fts_current_employee_id()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Employees: QC can read same-region employees excluding self and excluding other QCs
DROP POLICY IF EXISTS employees_select_same_region_for_qc ON employees;
CREATE POLICY employees_select_same_region_for_qc ON employees FOR SELECT
  USING (
    public.fts_current_employee_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.employee_roles er
      WHERE er.employee_id = public.fts_current_employee_id() AND er.role = 'QC'
    )
    AND region_id = public.fts_current_employee_region_id()
    AND id != public.fts_current_employee_id()
    AND id NOT IN (SELECT employee_id FROM public.employee_roles WHERE role = 'QC')
  );

-- Assets: QC can UPDATE assets currently assigned to them (to reassign to another employee)
DROP POLICY IF EXISTS assets_update_qc_reassign ON assets;
CREATE POLICY assets_update_qc_reassign ON assets FOR UPDATE
  USING (
    assigned_to_employee_id = public.fts_current_employee_id()
    AND EXISTS (
      SELECT 1 FROM public.employee_roles er
      WHERE er.employee_id = public.fts_current_employee_id() AND er.role = 'QC'
    )
  );

-- Asset assignment history: QC can insert when assigning an asset they currently hold
DROP POLICY IF EXISTS asset_assignment_history_insert_qc ON asset_assignment_history;
CREATE POLICY asset_assignment_history_insert_qc ON asset_assignment_history FOR INSERT
  WITH CHECK (
    public.fts_current_employee_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.employee_roles er WHERE er.employee_id = public.fts_current_employee_id() AND er.role = 'QC')
    AND asset_id IN (SELECT id FROM public.assets WHERE assigned_to_employee_id = public.fts_current_employee_id())
  );
