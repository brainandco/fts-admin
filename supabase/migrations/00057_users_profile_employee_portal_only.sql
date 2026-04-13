-- Distinguish employee-portal logins from admin Users list. Employee portal accounts are marked true;
-- admin invites / registration stay false. Backfill from current employees by email.

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS employee_portal_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users_profile.employee_portal_only IS
  'True when this profile is for Employee Portal login only (not an admin Users entry).';

UPDATE public.users_profile u
SET employee_portal_only = true
FROM public.employees e
WHERE lower(trim(both FROM coalesce(u.email, ''))) = lower(trim(both FROM coalesce(e.email, '')))
  AND trim(both FROM coalesce(e.email, '')) <> '';
