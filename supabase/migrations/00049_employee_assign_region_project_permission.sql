-- Granular permission: assign region/project on employees. Super User assigns this to roles via Settings → Roles & permissions.

INSERT INTO public.permissions (code, name, module)
VALUES (
  'employees.assign_region_project',
  'Assign employee region & project',
  'people'
)
ON CONFLICT (code) DO NOTHING;
