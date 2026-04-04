-- Extra regions for Project Managers (beyond employees.region_id). Only Super User may edit (enforced in app).
CREATE TABLE IF NOT EXISTS public.pm_region_assignments (
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_region_assignments_region ON public.pm_region_assignments(region_id);

COMMENT ON TABLE public.pm_region_assignments IS
  'Additional regions for a PM (rare). Primary region remains employees.region_id. Super User assigns extras in Admin.';

-- Projects a PM covers (multiple). Admins with user edit + Super User may assign.
CREATE TABLE IF NOT EXISTS public.pm_employee_projects (
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_employee_projects_project ON public.pm_employee_projects(project_id);

COMMENT ON TABLE public.pm_employee_projects IS
  'Projects a Project Manager is assigned to for team/tool scope. Complements projects.pm_user_id (portal user).';

ALTER TABLE public.pm_region_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_employee_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_region_assignments_service ON public.pm_region_assignments;
CREATE POLICY pm_region_assignments_service ON public.pm_region_assignments FOR ALL USING (false);

DROP POLICY IF EXISTS pm_employee_projects_service ON public.pm_employee_projects;
CREATE POLICY pm_employee_projects_service ON public.pm_employee_projects FOR ALL USING (false);

GRANT ALL ON public.pm_region_assignments TO service_role;
GRANT ALL ON public.pm_employee_projects TO service_role;
