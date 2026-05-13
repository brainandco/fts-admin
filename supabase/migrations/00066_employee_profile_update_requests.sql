-- Employee portal: requests to change name / phone / email (admin applies changes manually).

CREATE TABLE IF NOT EXISTS public.employee_profile_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  requested_full_name TEXT,
  requested_phone TEXT,
  requested_email TEXT,
  note_from_employee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES public.users_profile (id) ON DELETE SET NULL,
  CONSTRAINT employee_profile_update_requests_at_least_one_field CHECK (
    NULLIF(trim(COALESCE(requested_full_name, '')), '') IS NOT NULL
    OR NULLIF(trim(COALESCE(requested_phone, '')), '') IS NOT NULL
    OR NULLIF(trim(COALESCE(requested_email, '')), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_epur_employee_created
  ON public.employee_profile_update_requests (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_epur_status_created
  ON public.employee_profile_update_requests (status, created_at DESC);

COMMENT ON TABLE public.employee_profile_update_requests IS
  'Employee-submitted desired changes to name, phone, or email; administrators update the employee record and mark the request completed.';

ALTER TABLE public.employee_profile_update_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_profile_update_requests_select ON public.employee_profile_update_requests;
CREATE POLICY employee_profile_update_requests_select ON public.employee_profile_update_requests
  FOR SELECT
  USING (
    employee_id = public.fts_current_employee_id()
    OR public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employees.manage') = true
  );

DROP POLICY IF EXISTS employee_profile_update_requests_insert ON public.employee_profile_update_requests;
CREATE POLICY employee_profile_update_requests_insert ON public.employee_profile_update_requests
  FOR INSERT
  WITH CHECK (
    employee_id = public.fts_current_employee_id()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS employee_profile_update_requests_update ON public.employee_profile_update_requests;
CREATE POLICY employee_profile_update_requests_update ON public.employee_profile_update_requests
  FOR UPDATE
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employees.manage') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('employees.manage') = true
  );
