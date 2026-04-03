-- Ensure admin portal can read data: RLS helpers + admin policies.
-- Run this if admin UI shows no data (e.g. only employee-portal migrations were applied).

-- 1. RLS helper functions (admin permission checks)
CREATE OR REPLACE FUNCTION public.fts_is_super_or_has_permission(perm_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile up
    LEFT JOIN public.user_roles ur ON ur.user_id = up.id
    LEFT JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id AND p.code = perm_code
    LEFT JOIN public.user_permission_overrides upo ON upo.user_id = up.id
    LEFT JOIN public.permissions p2 ON p2.id = upo.permission_id AND p2.code = perm_code
    WHERE up.id = auth.uid()
    AND (up.is_super_user OR (p.id IS NOT NULL AND (upo.id IS NULL OR upo.granted)) OR (upo.granted = true))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_current_user_region_id()
RETURNS UUID AS $$
  SELECT region_id FROM public.region_pm_assignments WHERE user_id = auth.uid() AND is_current = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_is_pm_of_region(rid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.region_pm_assignments rpa
    WHERE rpa.region_id = rid AND rpa.user_id = auth.uid() AND rpa.is_current = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_is_super_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_super_user FROM public.users_profile WHERE id = auth.uid()), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Admin SELECT (and related) policies so admin UI can read data
-- Regions
DROP POLICY IF EXISTS regions_select ON regions;
CREATE POLICY regions_select ON regions FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_pm_of_region(id) = true
);
DROP POLICY IF EXISTS regions_all ON regions;
CREATE POLICY regions_all ON regions FOR ALL USING (
  public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_super_user() = true
);

-- Users profile
DROP POLICY IF EXISTS users_profile_select ON users_profile;
CREATE POLICY users_profile_select ON users_profile FOR SELECT USING (
  id = auth.uid() OR public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
);
DROP POLICY IF EXISTS users_profile_insert ON users_profile;
CREATE POLICY users_profile_insert ON users_profile FOR INSERT WITH CHECK (
  auth.uid() = id OR public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.create') = true
);
DROP POLICY IF EXISTS users_profile_update ON users_profile;
CREATE POLICY users_profile_update ON users_profile FOR UPDATE USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.edit') = true OR (id = auth.uid())
);
DROP POLICY IF EXISTS users_profile_delete ON users_profile;
CREATE POLICY users_profile_delete ON users_profile FOR DELETE USING (public.fts_is_super_user() = true);

-- Roles & permissions
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles FOR SELECT USING (public.fts_is_super_or_has_permission('roles.manage') = true OR public.fts_is_super_user() = true);
DROP POLICY IF EXISTS roles_all ON roles;
CREATE POLICY roles_all ON roles FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('roles.manage') = true);

DROP POLICY IF EXISTS permissions_select ON permissions;
CREATE POLICY permissions_select ON permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS permissions_all ON permissions;
CREATE POLICY permissions_all ON permissions FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('permissions.manage') = true);

DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (public.fts_is_super_or_has_permission('roles.manage') = true OR public.fts_is_super_user() = true);
DROP POLICY IF EXISTS role_permissions_all ON role_permissions;
CREATE POLICY role_permissions_all ON role_permissions FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('roles.manage') = true);

DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (
  public.fts_is_super_or_has_permission('users.view') = true OR public.fts_is_super_user() = true OR public.fts_current_user_region_id() IS NOT NULL
);
DROP POLICY IF EXISTS user_roles_all ON user_roles;
CREATE POLICY user_roles_all ON user_roles FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.edit') = true);

DROP POLICY IF EXISTS user_permission_overrides_select ON user_permission_overrides;
CREATE POLICY user_permission_overrides_select ON user_permission_overrides FOR SELECT USING (
  public.fts_is_super_or_has_permission('users.view') = true OR public.fts_is_super_user() = true
);
DROP POLICY IF EXISTS user_permission_overrides_all ON user_permission_overrides;
CREATE POLICY user_permission_overrides_all ON user_permission_overrides FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('permissions.manage') = true
);

-- Projects
DROP POLICY IF EXISTS projects_select ON projects;
CREATE POLICY projects_select ON projects FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('projects.manage') = true OR public.fts_is_pm_of_region(region_id) = true
);
DROP POLICY IF EXISTS projects_all ON projects;
CREATE POLICY projects_all ON projects FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('projects.manage') = true);

-- Teams
DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
);
DROP POLICY IF EXISTS teams_insert ON teams;
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
);
DROP POLICY IF EXISTS teams_update ON teams;
CREATE POLICY teams_update ON teams FOR UPDATE USING (public.fts_is_super_user() = true);
DROP POLICY IF EXISTS teams_delete ON teams;
CREATE POLICY teams_delete ON teams FOR DELETE USING (public.fts_is_super_user() = true);

-- Region PM assignments
DROP POLICY IF EXISTS region_pm_assignments_select ON region_pm_assignments;
CREATE POLICY region_pm_assignments_select ON region_pm_assignments FOR SELECT USING (
  public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_super_user() = true OR public.fts_is_pm_of_region(region_id) = true
);
DROP POLICY IF EXISTS region_pm_assignments_all ON region_pm_assignments;
CREATE POLICY region_pm_assignments_all ON region_pm_assignments FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('regions.manage') = true
);

-- Tasks
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('tasks.view_all') = true
  OR public.fts_is_pm_of_region(region_id) = true OR assigned_to_pm_id = auth.uid() OR assigned_to_user_id = auth.uid()
);
DROP POLICY IF EXISTS tasks_all ON tasks;
CREATE POLICY tasks_all ON tasks FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('tasks.create') = true
  OR public.fts_is_super_or_has_permission('tasks.edit') = true OR public.fts_is_pm_of_region(region_id) = true
);

DROP POLICY IF EXISTS task_comments_select ON task_comments;
CREATE POLICY task_comments_select ON task_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS task_comments_all ON task_comments;
CREATE POLICY task_comments_all ON task_comments FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS task_attachments_select ON task_attachments;
CREATE POLICY task_attachments_select ON task_attachments FOR SELECT USING (true);
DROP POLICY IF EXISTS task_attachments_all ON task_attachments;
CREATE POLICY task_attachments_all ON task_attachments FOR ALL USING (auth.uid() IS NOT NULL);

-- Approvals
DROP POLICY IF EXISTS approvals_select ON approvals;
CREATE POLICY approvals_select ON approvals FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('approvals.view') = true
  OR requester_id = auth.uid() OR (region_id IS NOT NULL AND public.fts_is_pm_of_region(region_id) = true)
);
DROP POLICY IF EXISTS approvals_all ON approvals;
CREATE POLICY approvals_all ON approvals FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('approvals.approve') = true
  OR public.fts_is_super_or_has_permission('approvals.reject') = true OR requester_id = auth.uid()
);

-- Assets
DROP POLICY IF EXISTS assets_select ON assets;
CREATE POLICY assets_select ON assets FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true
  OR (assigned_region_id IS NOT NULL AND public.fts_is_pm_of_region(assigned_region_id) = true)
);
DROP POLICY IF EXISTS assets_all ON assets;
CREATE POLICY assets_all ON assets FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true OR public.fts_is_super_or_has_permission('assets.assign') = true
);

-- Vehicles
DROP POLICY IF EXISTS vehicles_select ON vehicles;
CREATE POLICY vehicles_select ON vehicles FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);
DROP POLICY IF EXISTS vehicles_all ON vehicles;
CREATE POLICY vehicles_all ON vehicles FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);

DROP POLICY IF EXISTS vehicle_assignments_select ON vehicle_assignments;
CREATE POLICY vehicle_assignments_select ON vehicle_assignments FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);
DROP POLICY IF EXISTS vehicle_assignments_all ON vehicle_assignments;
CREATE POLICY vehicle_assignments_all ON vehicle_assignments FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);

DROP POLICY IF EXISTS vehicle_maintenance_select ON vehicle_maintenance;
CREATE POLICY vehicle_maintenance_select ON vehicle_maintenance FOR SELECT USING (true);
DROP POLICY IF EXISTS vehicle_maintenance_all ON vehicle_maintenance;
CREATE POLICY vehicle_maintenance_all ON vehicle_maintenance FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.maintenance_manage') = true
);

-- Employees (admin policies only; do not drop employees_select_own_by_email, employees_select_teammates, employees_select_same_region_for_qc)
DROP POLICY IF EXISTS employees_select ON employees;
CREATE POLICY employees_select ON employees FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
  OR (public.fts_current_user_region_id() IS NOT NULL AND region_id = public.fts_current_user_region_id())
);
DROP POLICY IF EXISTS employees_insert ON employees;
CREATE POLICY employees_insert ON employees FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.create') = true
  OR (public.fts_current_user_region_id() IS NOT NULL AND region_id = public.fts_current_user_region_id())
);
DROP POLICY IF EXISTS employees_update ON employees;
CREATE POLICY employees_update ON employees FOR UPDATE USING (public.fts_is_super_user() = true);
DROP POLICY IF EXISTS employees_delete ON employees;
CREATE POLICY employees_delete ON employees FOR DELETE USING (public.fts_is_super_user() = true);

-- Employee roles
DROP POLICY IF EXISTS employee_roles_select ON employee_roles;
CREATE POLICY employee_roles_select ON employee_roles FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
  OR EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_roles.employee_id AND public.fts_current_user_region_id() IS NOT NULL AND e.region_id = public.fts_current_user_region_id())
);
DROP POLICY IF EXISTS employee_roles_all ON employee_roles;
CREATE POLICY employee_roles_all ON employee_roles FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.create') = true OR public.fts_is_super_or_has_permission('users.edit') = true
  OR EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_roles.employee_id AND public.fts_current_user_region_id() IS NOT NULL AND e.region_id = public.fts_current_user_region_id())
);

-- Project region PM
DROP POLICY IF EXISTS project_region_pm_select ON project_region_pm;
CREATE POLICY project_region_pm_select ON project_region_pm FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_super_or_has_permission('projects.manage') = true
  OR (public.fts_current_user_region_id() IS NOT NULL AND region_id = public.fts_current_user_region_id())
);
DROP POLICY IF EXISTS project_region_pm_all ON project_region_pm;
CREATE POLICY project_region_pm_all ON project_region_pm FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_super_or_has_permission('projects.manage') = true
  OR (public.fts_current_user_region_id() IS NOT NULL AND region_id = public.fts_current_user_region_id())
);

-- Team members
DROP POLICY IF EXISTS team_members_select ON team_members;
CREATE POLICY team_members_select ON team_members FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
  OR EXISTS (SELECT 1 FROM teams t JOIN projects p ON p.id = t.project_id WHERE t.id = team_members.team_id AND public.fts_is_pm_of_region(p.region_id) = true)
);
DROP POLICY IF EXISTS team_members_all ON team_members;
CREATE POLICY team_members_all ON team_members FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true);

-- Team replacements
DROP POLICY IF EXISTS team_replacements_select ON team_replacements;
CREATE POLICY team_replacements_select ON team_replacements FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
);
DROP POLICY IF EXISTS team_replacements_insert ON team_replacements;
CREATE POLICY team_replacements_insert ON team_replacements FOR INSERT WITH CHECK (public.fts_is_super_user() = true);

-- Delegations
DROP POLICY IF EXISTS delegations_select ON delegations;
CREATE POLICY delegations_select ON delegations FOR SELECT USING (
  auth.uid() = delegator_user_id OR auth.uid() = delegatee_user_id OR public.fts_is_super_user() = true
);
DROP POLICY IF EXISTS delegations_insert ON delegations;
CREATE POLICY delegations_insert ON delegations FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true OR auth.uid() = delegator_user_id
);
DROP POLICY IF EXISTS delegations_update ON delegations;
CREATE POLICY delegations_update ON delegations FOR UPDATE USING (
  public.fts_is_super_user() = true OR auth.uid() = delegator_user_id
);
DROP POLICY IF EXISTS delegations_delete ON delegations;
CREATE POLICY delegations_delete ON delegations FOR DELETE USING (
  public.fts_is_super_user() = true OR auth.uid() = delegator_user_id
);

-- Asset assignment history (admin; QC insert policy is in 00011)
DROP POLICY IF EXISTS asset_assignment_history_select ON asset_assignment_history;
CREATE POLICY asset_assignment_history_select ON asset_assignment_history FOR SELECT
  USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true);
DROP POLICY IF EXISTS asset_assignment_history_insert ON asset_assignment_history;
CREATE POLICY asset_assignment_history_insert ON asset_assignment_history FOR INSERT
  WITH CHECK (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true);

-- Audit logs
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('audit_logs.view_all') = true
);
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
