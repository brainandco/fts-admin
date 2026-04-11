-- Software library metadata; files live in Wasabi (S3-compatible). Managed via admin API (service role).

CREATE TABLE IF NOT EXISTS public.portal_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  -- Object key inside WASABI_BUCKET (e.g. software/{id}/installer.zip).
  storage_key TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  byte_size BIGINT,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'active', 'failed')),
  uploaded_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_software_created ON public.portal_software(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_software_status ON public.portal_software(upload_status);

ALTER TABLE public.portal_software ENABLE ROW LEVEL SECURITY;

CREATE POLICY portal_software_deny_authenticated ON public.portal_software
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.portal_software IS 'Approved software catalog metadata; binary objects stored in external Wasabi bucket.';
