-- Track portal credential emails: team-level bulk action vs per-employee sends.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS last_team_credentials_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_team_credentials_email_sent_by UUID REFERENCES public.users_profile (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.teams.last_team_credentials_email_sent_at IS 'When an admin last used “send portal credentials to all members” for this team (at least one email succeeded).';
COMMENT ON COLUMN public.teams.last_team_credentials_email_sent_by IS 'Admin users_profile id who triggered the last team bulk credentials email.';

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS last_portal_credentials_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_portal_credentials_email_source TEXT;

COMMENT ON COLUMN public.employees.last_portal_credentials_email_sent_at IS 'Last successful portal credentials email to this employee.';
COMMENT ON COLUMN public.employees.last_portal_credentials_email_source IS 'employee_resend: employee detail; team_bulk: team send-all-members; employee_create: new employee from admin.';

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_last_portal_credentials_email_source_check;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_last_portal_credentials_email_source_check CHECK (
    last_portal_credentials_email_source IS NULL
    OR last_portal_credentials_email_source IN ('employee_resend', 'team_bulk', 'employee_create')
  );
