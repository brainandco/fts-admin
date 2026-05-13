-- Short public PP-reports folder ZIP links (folder name + id in URL; same pattern as employee_site_zip_share_links).

CREATE TABLE IF NOT EXISTS public.pp_reports_zip_share_links (
  id TEXT PRIMARY KEY,
  link_kind TEXT NOT NULL,
  reporter_slug TEXT,
  normalized_folder_path TEXT NOT NULL,
  folder_label TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pp_reports_zip_share_kind_chk CHECK (
    link_kind IN ('admin_bucket', 'pm_bucket', 'reporter')
  ),
  CONSTRAINT pp_reports_zip_share_reporter_chk CHECK (
    (link_kind = 'reporter' AND reporter_slug IS NOT NULL AND char_length(trim(reporter_slug)) > 0)
    OR (link_kind <> 'reporter' AND reporter_slug IS NULL)
  ),
  CONSTRAINT pp_reports_zip_share_path_len CHECK (char_length(normalized_folder_path) <= 4096),
  CONSTRAINT pp_reports_zip_share_folder_len CHECK (char_length(folder_label) <= 512),
  CONSTRAINT pp_reports_zip_share_slug_len CHECK (
    reporter_slug IS NULL OR char_length(reporter_slug) <= 256
  )
);

CREATE INDEX IF NOT EXISTS idx_pp_reports_zip_share_links_expires
  ON public.pp_reports_zip_share_links (expires_at);

COMMENT ON TABLE public.pp_reports_zip_share_links IS
  'Short-lived public PP reports folder ZIP keys; resolved by Next.js API using service role.';

ALTER TABLE public.pp_reports_zip_share_links ENABLE ROW LEVEL SECURITY;
