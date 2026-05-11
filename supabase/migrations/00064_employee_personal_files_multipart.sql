-- Track in-progress S3 multipart uploads for large employee personal / PP field / PM uploads.
ALTER TABLE public.employee_personal_files
  ADD COLUMN IF NOT EXISTS multipart_upload_id TEXT;

COMMENT ON COLUMN public.employee_personal_files.multipart_upload_id IS 'S3 UploadId while upload_status=pending and object is being assembled via multipart; cleared when active or failed.';
