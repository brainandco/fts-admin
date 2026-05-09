-- Junior DT: same field tooling / assignments as DT, but cannot occupy DT/Driver team slots until promoted to DT.

ALTER TABLE public.employee_roles DROP CONSTRAINT IF EXISTS employee_roles_role_check;
ALTER TABLE public.employee_roles ADD CONSTRAINT employee_roles_role_check
  CHECK (role IN (
    'DT',
    'Junior DT',
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
