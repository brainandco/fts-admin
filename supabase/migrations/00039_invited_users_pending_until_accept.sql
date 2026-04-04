-- Invited admin users: status should be PENDING_ACCESS until they accept (matches app invite flow).

UPDATE public.users_profile
SET status = 'PENDING_ACCESS'::user_status
WHERE invitation_token IS NOT NULL
  AND invitation_accepted_at IS NULL
  AND status = 'ACTIVE'::user_status;
