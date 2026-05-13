-- Short public ZIP share links (folder name + id in URL; no long signed query string).

CREATE TABLE IF NOT EXISTS public.employee_site_zip_share_links (
  id TEXT PRIMARY KEY,
  region_id UUID NOT NULL REFERENCES public.regions (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  normalized_site_path TEXT NOT NULL,
  folder_label TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_site_zip_share_path_len CHECK (char_length(normalized_site_path) <= 4096),
  CONSTRAINT employee_site_zip_share_folder_len CHECK (char_length(folder_label) <= 512)
);

CREATE INDEX IF NOT EXISTS idx_employee_site_zip_share_links_expires
  ON public.employee_site_zip_share_links (expires_at);

COMMENT ON TABLE public.employee_site_zip_share_links IS
  'Short-lived public site-folder ZIP download keys; resolved by Next.js API using service role.';

ALTER TABLE public.employee_site_zip_share_links ENABLE ROW LEVEL SECURITY;
