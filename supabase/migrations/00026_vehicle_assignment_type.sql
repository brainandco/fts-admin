ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'Permanent';

ALTER TABLE public.vehicles
DROP CONSTRAINT IF EXISTS vehicles_assignment_type_check;

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_assignment_type_check
CHECK (assignment_type IN ('Temporary', 'Permanent'));

COMMENT ON COLUMN public.vehicles.assignment_type IS 'Usage category for replacement flows: Temporary or Permanent.';
