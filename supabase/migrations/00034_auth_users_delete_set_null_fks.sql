-- Deleting a row from auth.users fails if other tables reference that user with ON DELETE NO ACTION (default).
-- Supabase Dashboard "Delete user" runs DELETE on auth.users; this migration sets ON DELETE SET NULL
-- on nullable columns so those references clear when the auth user is removed.
-- See: tasks.created_by was NOT NULL — it becomes nullable so we can SET NULL on user delete.

-- users_profile (manager chain)
ALTER TABLE public.users_profile DROP CONSTRAINT IF EXISTS users_profile_reports_to_user_id_fkey;
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_reports_to_user_id_fkey
  FOREIGN KEY (reports_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- user_roles (who assigned the role)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_assigned_by_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- projects
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_pm_user_id_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_pm_user_id_fkey
  FOREIGN KEY (pm_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- tasks
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_pm_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_pm_id_fkey
  FOREIGN KEY (assigned_to_pm_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_user_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_user_id_fkey
  FOREIGN KEY (assigned_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- task_attachments
ALTER TABLE public.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_uploaded_by_fkey;
ALTER TABLE public.task_attachments ADD CONSTRAINT task_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- approvals
ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_pm_acted_by_fkey;
ALTER TABLE public.approvals ADD CONSTRAINT approvals_pm_acted_by_fkey
  FOREIGN KEY (pm_acted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_admin_acted_by_fkey;
ALTER TABLE public.approvals ADD CONSTRAINT approvals_admin_acted_by_fkey
  FOREIGN KEY (admin_acted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- assets
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_assigned_to_user_id_fkey;
ALTER TABLE public.assets ADD CONSTRAINT assets_assigned_to_user_id_fkey
  FOREIGN KEY (assigned_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_assigned_by_fkey;
ALTER TABLE public.assets ADD CONSTRAINT assets_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- vehicles
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_assigned_to_user_id_fkey;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_assigned_to_user_id_fkey
  FOREIGN KEY (assigned_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_assigned_by_fkey;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- vehicle_maintenance
ALTER TABLE public.vehicle_maintenance DROP CONSTRAINT IF EXISTS vehicle_maintenance_created_by_fkey;
ALTER TABLE public.vehicle_maintenance ADD CONSTRAINT vehicle_maintenance_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- audit_logs
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- delegations (metadata only; delegator/delegatee already CASCADE)
ALTER TABLE public.delegations DROP CONSTRAINT IF EXISTS delegations_created_by_fkey;
ALTER TABLE public.delegations ADD CONSTRAINT delegations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
