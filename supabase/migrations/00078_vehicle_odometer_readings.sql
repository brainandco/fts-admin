-- Odometer morning/evening submissions (photos + OCR + confirmed readings)
-- OCR usage counter for hard monthly Cloud Vision cost cap (~$13)

CREATE TABLE IF NOT EXISTS public.ocr_usage_monthly (
  year_month TEXT PRIMARY KEY,
  units_used INTEGER NOT NULL DEFAULT 0 CHECK (units_used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ocr_usage_monthly IS
  'Monthly Google Cloud Vision OCR unit counter (1 image × 1 feature = 1 unit). Hard app cap ~9666 ≈ $13/mo.';

CREATE TABLE IF NOT EXISTS public.vehicle_odometer_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'evening')),
  reading_date DATE NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  plate_photo_url TEXT NOT NULL,
  odometer_photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ocr_plate_raw TEXT,
  ocr_odometer_raw TEXT,
  plate_number_final TEXT NOT NULL,
  odometer_km_final INTEGER NOT NULL CHECK (odometer_km_final >= 0),
  ocr_status TEXT NOT NULL CHECK (ocr_status IN ('ok', 'failed', 'skipped_quota')),
  ocr_units_used INTEGER NOT NULL DEFAULT 0 CHECK (ocr_units_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, reading_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_readings_employee
  ON public.vehicle_odometer_readings(employee_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_readings_vehicle
  ON public.vehicle_odometer_readings(vehicle_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_readings_created
  ON public.vehicle_odometer_readings(created_at DESC);

COMMENT ON TABLE public.vehicle_odometer_readings IS
  'Driver morning/evening odometer+plate photo submissions with OCR assist and confirmed values.';

ALTER TABLE public.vehicle_odometer_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_odometer_readings_select_staff ON public.vehicle_odometer_readings;
CREATE POLICY vehicle_odometer_readings_select_staff ON public.vehicle_odometer_readings
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('vehicles.manage') = true
    OR employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- Writes go through service role / app APIs only (no insert/update policies for anon/authenticated).
