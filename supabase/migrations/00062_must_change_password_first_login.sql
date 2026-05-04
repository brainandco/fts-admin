-- Require password change on first login for users who received an emailed temporary password.
-- Super users (flag or Super role) are exempt in app middleware/layout logic.

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users_profile.must_change_password IS
  'When true, portal forces /settings/change-password until the user sets a new password (cleared by app after updateUser).';

COMMENT ON COLUMN public.employees.must_change_password IS
  'When true, employee portal forces password change (typically after credentials email). Cleared by app after successful password update.';
