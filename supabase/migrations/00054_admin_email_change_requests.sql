-- Pending admin email changes: verified via link sent to the new address before auth + users_profile update.
CREATE TABLE public.admin_email_change_requests (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_email_change_requests_expires_at ON public.admin_email_change_requests (expires_at);
CREATE UNIQUE INDEX admin_email_change_requests_token_hash ON public.admin_email_change_requests (token_hash);

ALTER TABLE public.admin_email_change_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_email_change_requests IS 'Service-role only: token proves access to new email before updating auth.users email.';
