-- Align employees.email with Supabase Auth (lowercase). Fixes portal login when rows used mixed case.

UPDATE public.employees e
SET email = lower(trim(e.email))
WHERE e.email IS NOT NULL
  AND trim(e.email) <> ''
  AND e.email <> lower(trim(e.email));

UPDATE public.users_profile u
SET email = lower(trim(u.email))
WHERE u.email IS NOT NULL
  AND trim(u.email) <> ''
  AND u.email <> lower(trim(u.email));
