ALTER TABLE public.vehicle_odometer_readings
  ADD COLUMN IF NOT EXISTS activity_notes text;

COMMENT ON COLUMN public.vehicle_odometer_readings.activity_notes IS
  'Driver-written activity for this start/end reading; admin/QC checks manually.';
