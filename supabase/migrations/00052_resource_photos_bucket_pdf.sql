-- Allow PDFs in resource-photos (leave performa template, filled PDFs, company documents, signed uploads).
-- Previous bucket policy was images-only (00046), which rejected application/pdf.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY(
    SELECT DISTINCT x
    FROM unnest(
      COALESCE(
        NULLIF(allowed_mime_types, '{}'::text[]),
        ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
      ) || ARRAY['application/pdf'::text, 'application/octet-stream'::text]
    ) AS t(x)
  ),
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 26214400)
WHERE id = 'resource-photos';
