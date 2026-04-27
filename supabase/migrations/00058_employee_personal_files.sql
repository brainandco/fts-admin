-- Region-level Wasabi folders (metadata) + per-employee file rows. Objects: fts-employee-files-prod (or WASABI_EMPLOYEE_FILES_BUCKET) under prefix employee-files/...

INSERT INTO public.permissions (code, name, module)
VALUES (
  'employee_files.manage',
  'Manage employee file regions and browse all employee uploads',
  'people'
)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.employee_file_region_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.regions (id) ON DELETE CASCADE,
  -- Slug used in S3: employee-files/{path_segment}/...
  path_segment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users_profile (id) ON DELETE SET NULL,
  CONSTRAINT employee_file_region_folders_region_id_key UNIQUE (region_id),
  CONSTRAINT employee_file_region_folders_path_segment_key UNIQUE (path_segment)
);

CREATE INDEX IF NOT EXISTS idx_employee_file_region_folders_path ON public.employee_file_region_folders (path_segment);

CREATE TABLE IF NOT EXISTS public.employee_personal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions (id) ON DELETE RESTRICT,
  folder_id UUID NOT NULL REFERENCES public.employee_file_region_folders (id) ON DELETE RESTRICT,
  -- Full key inside the employee-files bucket
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  byte_size BIGINT,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'active', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_personal_files_storage_key_key UNIQUE (storage_key)
);

CREATE INDEX IF NOT EXISTS idx_employee_personal_files_employee ON public.employee_personal_files (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_personal_files_region ON public.employee_personal_files (region_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_personal_files_folder ON public.employee_personal_files (folder_id);

ALTER TABLE public.employee_file_region_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_personal_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_file_region_folders_deny_authenticated ON public.employee_file_region_folders
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY employee_personal_files_deny_authenticated ON public.employee_personal_files
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.employee_file_region_folders IS 'Admin-provisioned region "folders" (S3 prefix segments) for employee personal uploads; enforced in app API.';
COMMENT ON TABLE public.employee_personal_files IS 'Metadata for files uploaded by employees; binaries in external Wasabi bucket.';
