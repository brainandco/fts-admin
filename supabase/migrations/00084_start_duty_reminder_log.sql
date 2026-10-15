-- Dedupe log for "please start duty" reminders (Driver/Rigger with vehicle, no open duty).
-- Separate from open-duty 4h/8h/12h flags on vehicle_duty_shifts.

CREATE TABLE IF NOT EXISTS public.start_duty_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  window_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT start_duty_reminder_log_employee_window_unique UNIQUE (employee_id, window_key)
);

CREATE INDEX IF NOT EXISTS idx_start_duty_reminder_log_window
  ON public.start_duty_reminder_log (window_key);

COMMENT ON TABLE public.start_duty_reminder_log IS
  'One row per employee per morning/night nudge window so start-duty cron does not double-send.';

ALTER TABLE public.start_duty_reminder_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.start_duty_reminder_log TO service_role;
