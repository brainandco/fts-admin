-- Speed up site / folder name search on employee_personal_files.storage_key (ILIKE '%q%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_employee_personal_files_storage_key_trgm
  ON public.employee_personal_files
  USING gin (storage_key gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_employee_personal_files_region_status
  ON public.employee_personal_files (region_id, upload_status);
