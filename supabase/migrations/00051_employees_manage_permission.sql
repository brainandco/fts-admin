-- Create, edit, delete employee records (and import). Assign via Settings → Roles to Admin or custom roles.

INSERT INTO public.permissions (code, name, module)
VALUES (
  'employees.manage',
  'Manage employees',
  'people'
)
ON CONFLICT (code) DO NOTHING;
