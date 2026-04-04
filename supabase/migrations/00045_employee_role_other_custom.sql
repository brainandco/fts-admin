-- Free-text roles: role = 'Other' with role_custom; remove fixed support labels from CHECK.

ALTER TABLE public.employee_roles ADD COLUMN IF NOT EXISTS role_custom TEXT;

-- Existing rows that used fixed support labels become Other + preserved label in role_custom
UPDATE public.employee_roles
SET role_custom = role, role = 'Other'
WHERE role IN ('Supervisor', 'Warehouse', 'Logistics', 'HSE', 'Office');

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
    'Other'
  ));

ALTER TABLE public.employee_roles DROP CONSTRAINT IF EXISTS employee_roles_other_custom_check;
ALTER TABLE public.employee_roles ADD CONSTRAINT employee_roles_other_custom_check
  CHECK (
    (role = 'Other' AND role_custom IS NOT NULL AND char_length(trim(role_custom)) BETWEEN 1 AND 120)
    OR (role <> 'Other' AND role_custom IS NULL)
  );
