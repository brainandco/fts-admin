-- Employee accommodations (free text) and asset software connectivity (e.g. probe, TEMS, NEMO, PHU)

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS accommodations TEXT;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS software_connectivity TEXT;

COMMENT ON COLUMN public.employees.accommodations IS 'Accommodation details for the employee (free text).';
COMMENT ON COLUMN public.assets.software_connectivity IS 'Software/tool use for this asset (e.g. probe, TEMS, NEMO, PHU) — free text.';
