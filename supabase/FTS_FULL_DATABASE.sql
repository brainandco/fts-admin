-- =============================================================================
-- FTS Admin Portal - FULL DATABASE (clean install)
-- Run this entire script in Supabase Dashboard → SQL Editor on a NEW project
-- (or after deleting the project and creating a new one).
-- Regions: South (SOU), North (NTH), East (EST), West (WST), Central (CEN).
-- Super user: nabeel@fts-ksa.com / FTS-KSA@2026 (no email confirmation required).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('PENDING_ACCESS', 'ACTIVE', 'DISABLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status AS ENUM (
  'Draft', 'Assigned_to_PM', 'Assigned_to_User', 'In_Progress',
  'Blocked', 'Completed', 'Verified', 'Closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_status AS ENUM (
  'Submitted', 'PM_Approved', 'PM_Rejected', 'Admin_Approved', 'Admin_Rejected', 'Completed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_type AS ENUM (
  'leave_request', 'asset_request', 'vehicle_request', 'asset_return', 'maintenance_request'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_status AS ENUM ('Available', 'Assigned', 'Under_Maintenance', 'Damaged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE project_type AS ENUM ('MS', 'Rollout', 'Huawei Minor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. CORE TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status user_status NOT NULL DEFAULT 'PENDING_ACCESS',
  region_id UUID REFERENCES regions(id),
  reports_to_user_id UUID REFERENCES auth.users(id),
  is_super_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  module TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  project_type project_type NOT NULL,
  pm_user_id UUID REFERENCES auth.users(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  region_id UUID REFERENCES regions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  max_size INT DEFAULT 2,
  onboarding_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_teams_region ON teams(region_id);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'Draft',
  priority INT DEFAULT 0,
  due_date DATE,
  assigned_to_pm_id UUID REFERENCES auth.users(id),
  assigned_to_user_id UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX idx_tasks_region ON tasks(region_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type approval_type NOT NULL,
  status approval_status NOT NULL DEFAULT 'Submitted',
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id UUID REFERENCES regions(id),
  asset_id UUID,
  vehicle_id UUID,
  payload_json JSONB,
  pm_acted_at TIMESTAMPTZ,
  pm_acted_by UUID REFERENCES auth.users(id),
  pm_comment TEXT,
  admin_acted_at TIMESTAMPTZ,
  admin_acted_by UUID REFERENCES auth.users(id),
  admin_comment TEXT,
  admin_final_approver_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_type ON approvals(approval_type);
CREATE INDEX idx_approvals_requester ON approvals(requester_id);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  serial TEXT,
  purchase_date DATE,
  warranty_end DATE,
  condition TEXT,
  status asset_status NOT NULL DEFAULT 'Available',
  assigned_to_user_id UUID REFERENCES auth.users(id),
  assigned_region_id UUID REFERENCES regions(id),
  assigned_project_id UUID REFERENCES projects(id),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_assigned_to ON assets(assigned_to_user_id);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT NOT NULL,
  registration_number TEXT,
  make TEXT,
  model TEXT,
  year INT,
  vin TEXT,
  mileage INT DEFAULT 0,
  fuel_type TEXT,
  insurance_expiry DATE,
  license_expiry DATE,
  status asset_status NOT NULL DEFAULT 'Available',
  assigned_to_user_id UUID REFERENCES auth.users(id),
  assigned_region_id UUID REFERENCES regions(id),
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  next_service_due_date DATE,
  next_service_due_mileage INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);

CREATE TABLE vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  service_type TEXT,
  mileage_at_service INT,
  cost NUMERIC(12,2),
  notes TEXT,
  vendor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value_json JSONB,
  new_value_json JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  meta JSONB
);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS: set_updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_profile_updated_at BEFORE UPDATE ON users_profile FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER regions_updated_at BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER approvals_updated_at BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. TRIGGER: create users_profile on auth signup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'PENDING_ACCESS'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 5. SEED: permissions, roles, role_permissions, regions, projects
-- -----------------------------------------------------------------------------
INSERT INTO permissions (code, name, module) VALUES
  ('users.view', 'View users', 'users'),
  ('users.create', 'Create users', 'users'),
  ('users.edit', 'Edit users', 'users'),
  ('users.disable', 'Disable users', 'users'),
  ('roles.manage', 'Manage roles', 'rbac'),
  ('permissions.manage', 'Manage permissions', 'rbac'),
  ('regions.manage', 'Manage regions', 'regions'),
  ('projects.manage', 'Manage projects', 'projects'),
  ('teams.manage', 'Manage teams', 'teams'),
  ('tasks.create', 'Create tasks', 'tasks'),
  ('tasks.assign_to_pm', 'Assign tasks to PM', 'tasks'),
  ('tasks.assign_to_user', 'Assign tasks to user', 'tasks'),
  ('tasks.view_all', 'View all tasks', 'tasks'),
  ('tasks.edit', 'Edit tasks', 'tasks'),
  ('tasks.close', 'Close tasks', 'tasks'),
  ('assets.manage', 'Manage assets', 'assets'),
  ('assets.assign', 'Assign assets', 'assets'),
  ('assets.return', 'Process returns', 'assets'),
  ('vehicles.manage', 'Manage vehicles', 'vehicles'),
  ('vehicles.assign', 'Assign vehicles', 'vehicles'),
  ('vehicles.maintenance_manage', 'Manage vehicle maintenance', 'vehicles'),
  ('approvals.view', 'View approvals', 'approvals'),
  ('approvals.approve', 'Approve requests', 'approvals'),
  ('approvals.reject', 'Reject requests', 'approvals'),
  ('audit_logs.view_all', 'View audit logs', 'audit'),
  ('audit_logs.export', 'Export audit logs', 'audit'),
  ('settings.manage', 'Manage settings', 'settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Administrator', 'Full operational access, all regions'),
  ('a0000000-0000-0000-0000-000000000002', 'Regional Project Manager', 'Region-scoped PM'),
  ('a0000000-0000-0000-0000-000000000003', 'Admin Staff', 'Limited admin tasks')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code IN (
  'users.view', 'regions.manage', 'projects.manage', 'teams.manage',
  'tasks.create', 'tasks.assign_to_pm', 'tasks.assign_to_user', 'tasks.view_all', 'tasks.edit', 'tasks.close',
  'assets.manage', 'assets.assign', 'assets.return',
  'vehicles.manage', 'vehicles.assign', 'vehicles.maintenance_manage',
  'approvals.view', 'approvals.approve', 'approvals.reject',
  'audit_logs.view_all'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000003', id FROM permissions
WHERE code IN (
  'users.view', 'tasks.view_all', 'tasks.edit',
  'assets.manage', 'assets.assign', 'assets.return',
  'vehicles.manage', 'approvals.view', 'audit_logs.view_all'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO regions (id, name, code) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'South', 'SOU'),
  ('b0000000-0000-0000-0000-000000000002', 'North', 'NTH'),
  ('b0000000-0000-0000-0000-000000000003', 'East', 'EST'),
  ('b0000000-0000-0000-0000-000000000004', 'West', 'WST'),
  ('b0000000-0000-0000-0000-000000000005', 'Central', 'CEN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO projects (id, region_id, name, project_type, description) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Zain MS', 'MS', 'Zain MS project'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'STC MS', 'MS', 'STC MS project'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Mobily MS', 'MS', 'Mobily MS project'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Salam MS', 'MS', 'Salam MS project'),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Zain Rollout', 'Rollout', 'Zain Rollout project'),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'STC Rollout', 'Rollout', 'STC Rollout project'),
  ('d0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'Mobily Rollout', 'Rollout', 'Mobily Rollout project'),
  ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'Salam Rollout', 'Rollout', 'Salam Rollout project'),
  ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', 'Huawei Minor', 'Huawei Minor', 'Huawei Minor project')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. SUPER USER: nabeel@fts-ksa.com / FTS-KSA@2026 (no confirmation required)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_pw TEXT := crypt('FTS-KSA@2026', gen_salt('bf'));
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'nabeel@fts-ksa.com',
    v_pw,
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Nabeel"}'::jsonb,
    now(),
    now()
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (v_id, v_id, format('{"sub":"%s","email":"nabeel@fts-ksa.com"}', v_id)::jsonb, 'email', 'nabeel@fts-ksa.com', now(), now(), now());

  INSERT INTO public.users_profile (id, email, full_name, status, is_super_user)
  VALUES (v_id, 'nabeel@fts-ksa.com', 'Nabeel', 'ACTIVE', true)
  ON CONFLICT (id) DO UPDATE SET is_super_user = true, status = 'ACTIVE', full_name = 'Nabeel';
END $$;

-- -----------------------------------------------------------------------------
-- 7. EMPLOYEES & RELATED TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  passport_number TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  iqama_number TEXT NOT NULL DEFAULT '',
  department TEXT,
  job_title TEXT,
  region_id UUID NOT NULL REFERENCES regions(id),
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT,
  project_name_other TEXT,
  onboarding_date DATE,
  accommodations TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT employees_project_check CHECK (
    (project_id IS NOT NULL AND (project_name_other IS NULL OR trim(COALESCE(project_name_other,'')) = ''))
    OR (project_id IS NULL AND project_name_other IS NOT NULL AND trim(project_name_other) != '')
  )
);

CREATE TABLE employee_roles (
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DT', 'Driver/Rigger', 'QC', 'QA', 'Project Manager', 'Self DT', 'PP', 'Project Coordinator')),
  PRIMARY KEY (employee_id, role)
);
CREATE INDEX idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX idx_employee_roles_role ON employee_roles(role);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_region ON employees(region_id);
CREATE INDEX idx_employees_project ON employees(project_id);

CREATE TABLE vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id)
);
CREATE INDEX idx_vehicle_assignments_vehicle ON vehicle_assignments(vehicle_id);
CREATE INDEX idx_vehicle_assignments_employee ON vehicle_assignments(employee_id);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS dt_employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS driver_rigger_employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_teams_dt_employee ON teams(dt_employee_id);
CREATE INDEX IF NOT EXISTS idx_teams_driver_rigger_employee ON teams(driver_rigger_employee_id);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS software_connectivity TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS imei_1 TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS imei_2 TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model TEXT;
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to_employee ON assets(assigned_to_employee_id);

CREATE TABLE asset_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  to_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE INDEX idx_asset_assignment_history_asset ON asset_assignment_history(asset_id);
CREATE INDEX idx_asset_assignment_history_employee ON asset_assignment_history(to_employee_id);
CREATE INDEX idx_asset_assignment_history_at ON asset_assignment_history(assigned_at DESC);

CREATE TABLE IF NOT EXISTS asset_replacement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  for_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_by_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fulfilled', 'Rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  replacement_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_status ON asset_replacement_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_requested_by ON asset_replacement_requests(requested_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_for_employee ON asset_replacement_requests(for_employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_created ON asset_replacement_requests(created_at DESC);
ALTER TABLE asset_replacement_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE team_replacements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DT', 'Driver/Rigger')),
  previous_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  new_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  replaced_at TIMESTAMPTZ DEFAULT now(),
  replaced_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_team_replacements_team ON team_replacements(team_id);

CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegatee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CHECK (to_date >= from_date)
);
CREATE INDEX idx_delegations_delegatee_dates ON delegations(delegatee_user_id, from_date, to_date);

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. RLS HELPERS (public.fts_*)
-- -----------------------------------------------------------------------------
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
  SELECT NULL::UUID;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_is_pm_of_region(rid UUID)
RETURNS BOOLEAN AS $$
  SELECT false;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_is_super_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_super_user FROM public.users_profile WHERE id = auth.uid()), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Return current user's email (SECURITY DEFINER so RLS/policies don't need SELECT on auth.users)
CREATE OR REPLACE FUNCTION public.fts_auth_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Allow postgres (function owner) to read auth.users for SECURITY DEFINER functions and RPCs
DO $$ BEGIN GRANT USAGE ON SCHEMA auth TO postgres; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON auth.users TO postgres; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Avoid infinite recursion between employees and employee_roles RLS (see migration 00031).
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

-- -----------------------------------------------------------------------------
-- 9. ENABLE RLS ON ALL TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignment_history ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 10. RLS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY regions_select ON regions FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_pm_of_region(id) = true
);
CREATE POLICY regions_all ON regions FOR ALL USING (
  public.fts_is_super_or_has_permission('regions.manage') = true OR public.fts_is_super_user() = true
);

CREATE POLICY users_profile_select ON users_profile FOR SELECT USING (
  id = auth.uid() OR public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
);
CREATE POLICY users_profile_insert ON users_profile FOR INSERT WITH CHECK (
  auth.uid() = id OR public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.create') = true
);
CREATE POLICY users_profile_update ON users_profile FOR UPDATE USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.edit') = true OR (id = auth.uid())
);
CREATE POLICY users_profile_delete ON users_profile FOR DELETE USING (public.fts_is_super_user() = true);

CREATE POLICY roles_select ON roles FOR SELECT USING (public.fts_is_super_or_has_permission('roles.manage') = true OR public.fts_is_super_user() = true);
CREATE POLICY roles_all ON roles FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('roles.manage') = true);

CREATE POLICY permissions_select ON permissions FOR SELECT USING (true);
CREATE POLICY permissions_all ON permissions FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('permissions.manage') = true);

CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (public.fts_is_super_or_has_permission('roles.manage') = true OR public.fts_is_super_user() = true);
CREATE POLICY role_permissions_all ON role_permissions FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('roles.manage') = true);

CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (
  public.fts_is_super_or_has_permission('users.view') = true OR public.fts_is_super_user() = true OR public.fts_current_user_region_id() IS NOT NULL
);
CREATE POLICY user_roles_all ON user_roles FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.edit') = true);

CREATE POLICY user_permission_overrides_select ON user_permission_overrides FOR SELECT USING (
  public.fts_is_super_or_has_permission('users.view') = true OR public.fts_is_super_user() = true
);
CREATE POLICY user_permission_overrides_all ON user_permission_overrides FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('permissions.manage') = true
);

CREATE POLICY projects_select ON projects FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('projects.manage') = true OR public.fts_is_pm_of_region(region_id) = true
);
CREATE POLICY projects_all ON projects FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('projects.manage') = true);

CREATE POLICY teams_select ON teams FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
);
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
);
CREATE POLICY teams_update ON teams FOR UPDATE USING (public.fts_is_super_user() = true);
CREATE POLICY teams_delete ON teams FOR DELETE USING (public.fts_is_super_user() = true);

CREATE POLICY team_members_select ON team_members FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
  OR EXISTS (SELECT 1 FROM teams t JOIN projects p ON p.id = t.project_id WHERE t.id = team_members.team_id AND public.fts_is_pm_of_region(p.region_id) = true)
);
CREATE POLICY team_members_all ON team_members FOR ALL USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true);

CREATE POLICY tasks_select ON tasks FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('tasks.view_all') = true
  OR public.fts_is_pm_of_region(region_id) = true OR assigned_to_pm_id = auth.uid() OR assigned_to_user_id = auth.uid()
);
CREATE POLICY tasks_all ON tasks FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('tasks.create') = true
  OR public.fts_is_super_or_has_permission('tasks.edit') = true OR public.fts_is_pm_of_region(region_id) = true
);

CREATE POLICY task_comments_select ON task_comments FOR SELECT USING (true);
CREATE POLICY task_comments_all ON task_comments FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY task_attachments_select ON task_attachments FOR SELECT USING (true);
CREATE POLICY task_attachments_all ON task_attachments FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY approvals_select ON approvals FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('approvals.view') = true
  OR requester_id = auth.uid() OR (region_id IS NOT NULL AND public.fts_is_pm_of_region(region_id) = true)
);
CREATE POLICY approvals_all ON approvals FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('approvals.approve') = true
  OR public.fts_is_super_or_has_permission('approvals.reject') = true OR requester_id = auth.uid()
);

CREATE POLICY assets_select ON assets FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true
  OR (assigned_region_id IS NOT NULL AND public.fts_is_pm_of_region(assigned_region_id) = true)
);
CREATE POLICY assets_all ON assets FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true OR public.fts_is_super_or_has_permission('assets.assign') = true
);

CREATE POLICY vehicles_select ON vehicles FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);
CREATE POLICY vehicles_all ON vehicles FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);

CREATE POLICY vehicle_assignments_select ON vehicle_assignments FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);
CREATE POLICY vehicle_assignments_all ON vehicle_assignments FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.manage') = true
);

CREATE POLICY vehicle_maintenance_select ON vehicle_maintenance FOR SELECT USING (true);
CREATE POLICY vehicle_maintenance_all ON vehicle_maintenance FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('vehicles.maintenance_manage') = true
);

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('audit_logs.view_all') = true
);
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Employees: admin/PM by region; employee portal can read own row by email
CREATE POLICY employees_select ON employees FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
  OR (public.fts_current_user_region_id() IS NOT NULL AND region_id = public.fts_current_user_region_id())
);
CREATE POLICY employees_select_own_by_email ON employees FOR SELECT TO authenticated USING (
  public.fts_auth_user_email() IS NOT NULL
  AND LOWER(TRIM(COALESCE(employees.email, ''))) = LOWER(TRIM(public.fts_auth_user_email()))
);
CREATE POLICY employees_insert ON employees FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.create') = true
  OR (public.fts_current_user_region_id() IS NOT NULL AND region_id = public.fts_current_user_region_id())
);
CREATE POLICY employees_update ON employees FOR UPDATE USING (public.fts_is_super_user() = true);
CREATE POLICY employees_delete ON employees FOR DELETE USING (public.fts_is_super_user() = true);

CREATE POLICY employee_roles_select ON employee_roles FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.view') = true
  OR (
    public.fts_current_user_region_id() IS NOT NULL
    AND public.fts_internal_employee_region_id(employee_roles.employee_id) = public.fts_current_user_region_id()
  )
);
CREATE POLICY employee_roles_all ON employee_roles FOR ALL USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('users.create') = true OR public.fts_is_super_or_has_permission('users.edit') = true
  OR (
    public.fts_current_user_region_id() IS NOT NULL
    AND public.fts_internal_employee_region_id(employee_roles.employee_id) = public.fts_current_user_region_id()
  )
);

CREATE POLICY team_replacements_select ON team_replacements FOR SELECT USING (
  public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('teams.manage') = true
);
CREATE POLICY team_replacements_insert ON team_replacements FOR INSERT WITH CHECK (public.fts_is_super_user() = true);

CREATE POLICY delegations_select ON delegations FOR SELECT USING (
  auth.uid() = delegator_user_id OR auth.uid() = delegatee_user_id OR public.fts_is_super_user() = true
);
CREATE POLICY delegations_insert ON delegations FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true OR auth.uid() = delegator_user_id
);
CREATE POLICY delegations_update ON delegations FOR UPDATE USING (
  public.fts_is_super_user() = true OR auth.uid() = delegator_user_id
);
CREATE POLICY delegations_delete ON delegations FOR DELETE USING (
  public.fts_is_super_user() = true OR auth.uid() = delegator_user_id
);

CREATE POLICY asset_assignment_history_select ON asset_assignment_history FOR SELECT
  USING (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true);
CREATE POLICY asset_assignment_history_insert ON asset_assignment_history FOR INSERT
  WITH CHECK (public.fts_is_super_user() = true OR public.fts_is_super_or_has_permission('assets.manage') = true);

-- -----------------------------------------------------------------------------
-- 11. EMPLOYEE PORTAL: read own region, assets, vehicles, teams, teammates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fts_current_employee_id()
RETURNS UUID AS $$
  SELECT e.id FROM public.employees e
  WHERE public.fts_auth_user_email() IS NOT NULL
    AND LOWER(TRIM(COALESCE(e.email, ''))) = LOWER(TRIM(public.fts_auth_user_email()))
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE POLICY regions_select_own_employee ON regions FOR SELECT
  USING (id = (SELECT region_id FROM public.employees WHERE id = public.fts_current_employee_id()));

CREATE POLICY assets_select_own_employee ON assets FOR SELECT
  USING (assigned_to_employee_id = public.fts_current_employee_id());

CREATE POLICY vehicle_assignments_select_own_employee ON vehicle_assignments FOR SELECT
  USING (employee_id = public.fts_current_employee_id());

CREATE POLICY vehicles_select_own_assigned ON vehicles FOR SELECT
  USING (id IN (SELECT vehicle_id FROM public.vehicle_assignments WHERE employee_id = public.fts_current_employee_id()));

CREATE POLICY teams_select_own_employee ON teams FOR SELECT
  USING (dt_employee_id = public.fts_current_employee_id() OR driver_rigger_employee_id = public.fts_current_employee_id());

CREATE POLICY employees_select_teammates ON employees FOR SELECT
  USING (id IN (
    SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
    UNION
    SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
  ));

CREATE POLICY employee_roles_select_own ON employee_roles FOR SELECT
  USING (employee_id = public.fts_current_employee_id() OR employee_id IN (
    SELECT dt_employee_id FROM public.teams WHERE driver_rigger_employee_id = public.fts_current_employee_id()
    UNION
    SELECT driver_rigger_employee_id FROM public.teams WHERE dt_employee_id = public.fts_current_employee_id()
  ));

CREATE POLICY projects_select_own_employee ON projects FOR SELECT
  USING (id = (SELECT project_id FROM public.employees WHERE id = public.fts_current_employee_id()));

-- -----------------------------------------------------------------------------
-- 12. QC PORTAL: same-region employees (excl. other QCs), reassign assets
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fts_current_employee_region_id()
RETURNS UUID AS $$
  SELECT e.region_id FROM public.employees e
  WHERE e.id = public.fts_current_employee_id()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE POLICY employees_select_same_region_for_qc ON employees FOR SELECT
  USING (
    public.fts_current_employee_id() IS NOT NULL
    AND public.fts_internal_employee_has_role(public.fts_current_employee_id(), 'QC')
    AND region_id = public.fts_current_employee_region_id()
    AND id != public.fts_current_employee_id()
    AND NOT public.fts_internal_employee_has_role(id, 'QC')
  );

CREATE POLICY assets_update_qc_reassign ON assets FOR UPDATE
  USING (
    assigned_to_employee_id = public.fts_current_employee_id()
    AND public.fts_internal_employee_has_role(public.fts_current_employee_id(), 'QC')
  );

CREATE POLICY asset_assignment_history_insert_qc ON asset_assignment_history FOR INSERT
  WITH CHECK (
    public.fts_current_employee_id() IS NOT NULL
    AND public.fts_internal_employee_has_role(public.fts_current_employee_id(), 'QC')
    AND asset_id IN (SELECT id FROM public.assets WHERE assigned_to_employee_id = public.fts_current_employee_id())
  );

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_user_id, is_read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  recipient_user_id = auth.uid()
  OR public.fts_is_super_user() = true
  OR public.fts_is_super_or_has_permission('users.view') = true
);
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (
  public.fts_is_super_user() = true
  OR public.fts_is_super_or_has_permission('users.edit') = true
  OR public.fts_is_super_or_has_permission('approvals.approve') = true
  OR public.fts_is_super_or_has_permission('approvals.reject') = true
  OR recipient_user_id = auth.uid()
);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  recipient_user_id = auth.uid() OR public.fts_is_super_user() = true
) WITH CHECK (
  recipient_user_id = auth.uid() OR public.fts_is_super_user() = true
);

-- =============================================================================
-- DONE. Super user: nabeel@fts-ksa.com / FTS-KSA@2026 — login to admin with no confirmation.
-- =============================================================================
