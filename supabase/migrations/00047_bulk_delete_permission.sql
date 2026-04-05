-- Granular permission for bulk delete operations. Super User assigns this to roles via Settings → Roles & permissions.

INSERT INTO public.permissions (code, name, module)
VALUES (
  'bulk_delete.execute',
  'Execute bulk deletes',
  'system'
)
ON CONFLICT (code) DO NOTHING;
