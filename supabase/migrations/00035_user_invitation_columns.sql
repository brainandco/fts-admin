-- Admin portal invitations: accept within 24h; access only after acceptance.
-- Legacy users: invitation_token IS NULL → treated as already onboarded.

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS invitation_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;

-- Existing rows: full access (no invitation step).
UPDATE public.users_profile
SET invitation_accepted_at = COALESCE(invitation_accepted_at, created_at, now())
WHERE invitation_accepted_at IS NULL;

-- Stop using PENDING_ACCESS for new signups; migrate old rows to ACTIVE.
UPDATE public.users_profile
SET status = 'ACTIVE'::user_status
WHERE status = 'PENDING_ACCESS'::user_status;

-- New auth users: ACTIVE + invitation accepted (invite flow overwrites with token + pending).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, email, full_name, status, invitation_accepted_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'ACTIVE',
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
