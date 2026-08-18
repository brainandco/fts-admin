-- Duty start/end is the odometer submission (not calendar morning/evening).
-- Night shifts can start one calendar day and end the next.

ALTER TABLE public.vehicle_odometer_readings
  DROP CONSTRAINT IF EXISTS vehicle_odometer_readings_slot_check;

ALTER TABLE public.vehicle_odometer_readings
  ADD CONSTRAINT vehicle_odometer_readings_slot_check
  CHECK (slot IN ('morning', 'evening', 'start', 'end'));

CREATE TABLE IF NOT EXISTS public.vehicle_duty_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  start_reading_id UUID,
  end_reading_id UUID,
  start_km INTEGER NOT NULL CHECK (start_km >= 0),
  end_km INTEGER CHECK (end_km IS NULL OR end_km >= 0),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_duty_shifts IS
  'One vehicle duty. Opens only after start odometer photos are saved; closes only after end odometer photos are saved.';

ALTER TABLE public.vehicle_odometer_readings
  ADD COLUMN IF NOT EXISTS duty_shift_id UUID;

ALTER TABLE public.vehicle_odometer_readings
  DROP CONSTRAINT IF EXISTS vehicle_odometer_readings_vehicle_id_reading_date_slot_key;

-- Backfill one shift per vehicle + calendar date from existing morning/evening rows.
INSERT INTO public.vehicle_duty_shifts (
  vehicle_id, employee_id, team_id, shift_date, started_at, ended_at,
  start_reading_id, end_reading_id, start_km, end_km, status
)
SELECT
  g.vehicle_id,
  COALESCE(g.start_emp, g.end_emp),
  g.start_team,
  g.reading_date,
  COALESCE(g.start_at, g.end_at),
  CASE WHEN g.end_id IS NOT NULL THEN g.end_at ELSE NULL END,
  g.start_id,
  g.end_id,
  COALESCE(g.start_km, g.end_km, 0),
  g.end_km,
  'closed'
FROM (
  SELECT
    vehicle_id,
    reading_date,
    (array_agg(id) FILTER (WHERE slot IN ('morning', 'start')))[1] AS start_id,
    (array_agg(employee_id) FILTER (WHERE slot IN ('morning', 'start')))[1] AS start_emp,
    (array_agg(team_id) FILTER (WHERE slot IN ('morning', 'start')))[1] AS start_team,
    (array_agg(captured_at) FILTER (WHERE slot IN ('morning', 'start')))[1] AS start_at,
    (array_agg(odometer_km_final) FILTER (WHERE slot IN ('morning', 'start')))[1] AS start_km,
    (array_agg(id) FILTER (WHERE slot IN ('evening', 'end')))[1] AS end_id,
    (array_agg(employee_id) FILTER (WHERE slot IN ('evening', 'end')))[1] AS end_emp,
    (array_agg(captured_at) FILTER (WHERE slot IN ('evening', 'end')))[1] AS end_at,
    (array_agg(odometer_km_final) FILTER (WHERE slot IN ('evening', 'end')))[1] AS end_km
  FROM public.vehicle_odometer_readings
  GROUP BY vehicle_id, reading_date
) g
WHERE COALESCE(g.start_emp, g.end_emp) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.vehicle_duty_shifts s
    WHERE s.vehicle_id = g.vehicle_id AND s.shift_date = g.reading_date
  );

UPDATE public.vehicle_odometer_readings r
SET duty_shift_id = s.id
FROM public.vehicle_duty_shifts s
WHERE r.duty_shift_id IS NULL
  AND s.vehicle_id = r.vehicle_id
  AND s.shift_date = r.reading_date;

UPDATE public.vehicle_odometer_readings SET slot = 'start' WHERE slot = 'morning';
UPDATE public.vehicle_odometer_readings SET slot = 'end' WHERE slot = 'evening';

ALTER TABLE public.vehicle_odometer_readings
  DROP CONSTRAINT IF EXISTS vehicle_odometer_readings_slot_check;

ALTER TABLE public.vehicle_odometer_readings
  ADD CONSTRAINT vehicle_odometer_readings_slot_check
  CHECK (slot IN ('start', 'end'));

-- Keep a currently-open duty only for the latest start-without-end in the last 36 hours.
UPDATE public.vehicle_duty_shifts s
SET status = 'open', updated_at = now()
WHERE s.id IN (
  SELECT DISTINCT ON (d.vehicle_id) d.id
  FROM public.vehicle_duty_shifts d
  WHERE d.end_reading_id IS NULL
    AND d.started_at > now() - interval '36 hours'
  ORDER BY d.vehicle_id, d.started_at DESC
);

UPDATE public.vehicle_duty_shifts s
SET status = 'closed', updated_at = now()
WHERE s.status = 'open'
  AND s.id NOT IN (
    SELECT DISTINCT ON (d.employee_id) d.id
    FROM public.vehicle_duty_shifts d
    WHERE d.status = 'open'
    ORDER BY d.employee_id, d.started_at DESC
  );

ALTER TABLE public.vehicle_odometer_readings
  DROP CONSTRAINT IF EXISTS vehicle_odometer_readings_duty_shift_id_fkey;

ALTER TABLE public.vehicle_odometer_readings
  ADD CONSTRAINT vehicle_odometer_readings_duty_shift_id_fkey
  FOREIGN KEY (duty_shift_id) REFERENCES public.vehicle_duty_shifts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_odometer_readings_shift_slot_uidx
  ON public.vehicle_odometer_readings (duty_shift_id, slot)
  WHERE duty_shift_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_duty_shifts_one_open_per_vehicle
  ON public.vehicle_duty_shifts (vehicle_id)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_duty_shifts_one_open_per_employee
  ON public.vehicle_duty_shifts (employee_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_vehicle_duty_shifts_vehicle_date
  ON public.vehicle_duty_shifts (vehicle_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_duty_shifts_employee
  ON public.vehicle_duty_shifts (employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_readings_shift
  ON public.vehicle_odometer_readings (duty_shift_id);

ALTER TABLE public.vehicle_duty_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_duty_shifts_select_staff ON public.vehicle_duty_shifts;
CREATE POLICY vehicle_duty_shifts_select_staff ON public.vehicle_duty_shifts
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('vehicles.manage') = true
    OR employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
