-- Enhanced audit logging: portal source, HTTP context, action categories

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS portal TEXT,
  ADD COLUMN IF NOT EXISTS route_path TEXT,
  ADD COLUMN IF NOT EXISTS http_method TEXT,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS action_category TEXT;

COMMENT ON COLUMN public.audit_logs.portal IS 'admin | employee';
COMMENT ON COLUMN public.audit_logs.action_category IS 'auth | file | data | assignment | approval | export | system | api';

CREATE INDEX IF NOT EXISTS idx_audit_portal_timestamp ON public.audit_logs (portal, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_category ON public.audit_logs (action_category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_route_path ON public.audit_logs (route_path);

-- Inserts: authenticated users via app; service role (middleware) bypasses RLS.
