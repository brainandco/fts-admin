-- PP final reports folder hierarchy: Region (public.regions) → Operator → Account → Project.

CREATE OR REPLACE FUNCTION public.fts_is_reporting_portal_employee()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    WHERE er.employee_id = public.fts_current_employee_id()
      AND er.role IN ('PP', 'Reporting Team')
  );
$$;

CREATE TABLE IF NOT EXISTS public.pp_report_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pp_report_operators_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT pp_report_operators_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.pp_report_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pp_report_accounts_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT pp_report_accounts_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.pp_report_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.pp_report_operators (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pp_report_projects_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  CONSTRAINT pp_report_projects_operator_name_unique UNIQUE (operator_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pp_report_projects_operator ON public.pp_report_projects (operator_id);

COMMENT ON TABLE public.pp_report_operators IS 'Lookup: operator folder names under each PP reporter folder in final reports bucket.';
COMMENT ON TABLE public.pp_report_accounts IS 'Lookup: account folder names under operator folders.';
COMMENT ON TABLE public.pp_report_projects IS 'Lookup: project folder names under account folders; scoped to operator.';

-- Seed operators
INSERT INTO public.pp_report_operators (name, sort_order) VALUES
  ('STC', 1),
  ('Zain', 2),
  ('Mobily', 3)
ON CONFLICT (name) DO NOTHING;

-- Seed accounts
INSERT INTO public.pp_report_accounts (name, sort_order) VALUES
  ('Rollout', 1),
  ('MS', 2)
ON CONFLICT (name) DO NOTHING;

-- Seed projects (operator → projects)
INSERT INTO public.pp_report_projects (operator_id, name, sort_order)
SELECT o.id, p.name, p.sort_order
FROM (VALUES
  ('STC', 'Saudi STC Trial', 1),
  ('STC', 'Saudi STC Nationwide USF Project 2024', 2),
  ('STC', 'Saudi STC 5G Phase8 Project 2026', 3),
  ('STC', 'Saudi STC 5G Phase5 Project 2023', 4),
  ('STC', 'Saudi STC 5G Phase6 Project 2024', 5),
  ('STC', 'Saudi STC SWAP Project 2024', 6),
  ('STC', 'Saudi STC 5G Phase7 Project 2025', 7),
  ('STC', 'Saudi STC Mission Critical Project 2025', 8),
  ('STC', 'Saudi Aramco ADC 450M Project', 9),
  ('STC', 'Saudi STC RDP Project 2025', 10),
  ('STC', 'STC WBB5 Localities', 11),
  ('STC', 'STC WWB4 Localities', 12),
  ('Mobily', 'Mobily Localities', 1),
  ('Mobily', 'Mobily IBS', 2),
  ('Mobily', 'East Obligation WL 5G 3.7G SW', 3),
  ('Mobily', 'Saudi Mobily Next Project 2023', 4),
  ('Zain', 'Zain Localities', 1),
  ('Zain', 'Zain IBS', 2),
  ('Zain', 'Saudi Zain Sophia 4 Project 2024', 3)
) AS p(operator_name, name, sort_order)
JOIN public.pp_report_operators o ON o.name = p.operator_name
ON CONFLICT (operator_id, name) DO NOTHING;

ALTER TABLE public.pp_report_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pp_report_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pp_report_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pp_report_operators_select ON public.pp_report_operators;
CREATE POLICY pp_report_operators_select ON public.pp_report_operators
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
    OR public.fts_is_reporting_portal_employee() = true
  );

DROP POLICY IF EXISTS pp_report_operators_manage ON public.pp_report_operators;
CREATE POLICY pp_report_operators_manage ON public.pp_report_operators
  FOR ALL
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
  );

DROP POLICY IF EXISTS pp_report_accounts_select ON public.pp_report_accounts;
CREATE POLICY pp_report_accounts_select ON public.pp_report_accounts
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
    OR public.fts_is_reporting_portal_employee() = true
  );

DROP POLICY IF EXISTS pp_report_accounts_manage ON public.pp_report_accounts;
CREATE POLICY pp_report_accounts_manage ON public.pp_report_accounts
  FOR ALL
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
  );

DROP POLICY IF EXISTS pp_report_projects_select ON public.pp_report_projects;
CREATE POLICY pp_report_projects_select ON public.pp_report_projects
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
    OR public.fts_is_reporting_portal_employee() = true
  );

DROP POLICY IF EXISTS pp_report_projects_manage ON public.pp_report_projects;
CREATE POLICY pp_report_projects_manage ON public.pp_report_projects
  FOR ALL
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employee_files.manage') = true
  );
