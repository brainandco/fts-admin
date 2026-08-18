-- Human-readable place name from lat/lng (reverse geocode) for odometer submissions

ALTER TABLE public.vehicle_odometer_readings
  ADD COLUMN IF NOT EXISTS location_label TEXT;

COMMENT ON COLUMN public.vehicle_odometer_readings.location_label IS
  'Reverse-geocoded place name (road / district / city) from captured GPS.';
