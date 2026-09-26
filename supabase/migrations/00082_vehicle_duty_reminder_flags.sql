-- Track duty limit reminder notifications (4h / 8h / 12h). Add-only; does not change start/end duty rules.

ALTER TABLE public.vehicle_duty_shifts
  ADD COLUMN IF NOT EXISTS reminder_4h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_8h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_12h_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vehicle_duty_shifts.reminder_4h_sent_at IS
  'When the 4-hour remaining-duty reminder was sent to the on-duty employee.';
COMMENT ON COLUMN public.vehicle_duty_shifts.reminder_8h_sent_at IS
  'When the 8-hour remaining-duty reminder was sent to the on-duty employee.';
COMMENT ON COLUMN public.vehicle_duty_shifts.reminder_12h_sent_at IS
  'When the 12-hour duty-limit alert was sent to the on-duty employee and vehicle admins.';

CREATE INDEX IF NOT EXISTS idx_vehicle_duty_shifts_open_started
  ON public.vehicle_duty_shifts (started_at)
  WHERE status = 'open';
