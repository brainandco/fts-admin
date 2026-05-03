-- Employee role: Reporting Team (admin create/edit + import; not a DT/Driver team slot).

ALTER TABLE public.employee_roles DROP CONSTRAINT IF EXISTS employee_roles_role_check;
ALTER TABLE public.employee_roles ADD CONSTRAINT employee_roles_role_check
  CHECK (role IN (
    'DT',
    'Driver/Rigger',
    'QC',
    'QA',
    'Project Manager',
    'Self DT',
    'PP',
    'Project Coordinator',
    'Reporting Team',
    'Other'
  ));
