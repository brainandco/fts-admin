ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

COMMENT ON COLUMN public.vehicles.vehicle_type IS 'Vehicle type, if applicable.';
