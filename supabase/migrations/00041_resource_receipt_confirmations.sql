-- Pending "I received it" confirmations for assets, SIM cards, and vehicles assigned to employees.

CREATE TABLE IF NOT EXISTS public.resource_receipt_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('asset', 'sim_card', 'vehicle')),
  resource_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  confirmation_message TEXT,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resource_receipt_confirmations_resource_unique UNIQUE (resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_receipt_confirmations_employee_status
  ON public.resource_receipt_confirmations(employee_id, status);

COMMENT ON TABLE public.resource_receipt_confirmations IS
  'Tracks whether assignees confirmed physical receipt of an asset, SIM, or vehicle. One row per resource; reassignment replaces the row.';

ALTER TABLE public.resource_receipt_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_receipt_confirmations_select_own ON public.resource_receipt_confirmations;
CREATE POLICY resource_receipt_confirmations_select_own ON public.resource_receipt_confirmations
  FOR SELECT
  USING (
    employee_id = public.fts_current_employee_id()
    OR public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
  );

DROP POLICY IF EXISTS resource_receipt_confirmations_update_own ON public.resource_receipt_confirmations;
CREATE POLICY resource_receipt_confirmations_update_own ON public.resource_receipt_confirmations
  FOR UPDATE
  USING (
    employee_id = public.fts_current_employee_id()
    AND status = 'pending'
  )
  WITH CHECK (
    employee_id = public.fts_current_employee_id()
    AND status = 'confirmed'
  );

GRANT SELECT, UPDATE ON public.resource_receipt_confirmations TO authenticated;
GRANT ALL ON public.resource_receipt_confirmations TO service_role;
