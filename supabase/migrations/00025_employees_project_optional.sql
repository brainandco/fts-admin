ALTER TABLE public.employees
DROP CONSTRAINT IF EXISTS employees_project_check;

ALTER TABLE public.employees
ADD CONSTRAINT employees_project_check CHECK (
  -- project selected
  (
    project_id IS NOT NULL
    AND (project_name_other IS NULL OR trim(COALESCE(project_name_other, '')) = '')
  )
  OR
  -- "Other" project entered
  (
    project_id IS NULL
    AND project_name_other IS NOT NULL
    AND trim(project_name_other) <> ''
  )
  OR
  -- project intentionally not set (allowed for role-based flows like Driver/Rigger)
  (
    project_id IS NULL
    AND (project_name_other IS NULL OR trim(COALESCE(project_name_other, '')) = '')
  )
);
