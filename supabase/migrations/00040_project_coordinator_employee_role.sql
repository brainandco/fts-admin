-- Employee role: Project Coordinator (region + project assigned on admin Region & project page; not a team member).
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
    'Project Coordinator'
  ));
