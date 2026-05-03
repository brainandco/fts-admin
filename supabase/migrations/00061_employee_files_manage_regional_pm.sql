-- Project Managers (Regional Project Manager admin role) get the same Employee files + PP final reports access
-- as users explicitly granted employee_files.manage (browse, upload, delete, region folders, site search, zip links).
-- Administrator is included so installs that added employee_files.manage after the initial role seed still have the perm.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.code = 'employee_files.manage'
  AND r.id IN (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000002'::uuid
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
