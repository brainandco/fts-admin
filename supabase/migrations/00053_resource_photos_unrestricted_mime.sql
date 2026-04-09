-- Company documents and other uploads use many MIME types (pdf, doc, docx, octet-stream, etc.).
-- An allowlist on resource-photos caused "mime type ... is not supported" for generic binaries.
-- NULL = no MIME restriction at bucket level; APIs still validate where needed (e.g. condition photos = images only).

UPDATE storage.buckets
SET
  allowed_mime_types = NULL,
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800)
WHERE id = 'resource-photos';
