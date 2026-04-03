-- SIM inventory and assignment tracking (including active IMEI mapping).

CREATE TABLE IF NOT EXISTS public.sim_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('Data', 'Voice', 'Data+Voice')),
  sim_number TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Assigned', 'Inactive')),
  assigned_to_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON public.sim_cards(status);
CREATE INDEX IF NOT EXISTS idx_sim_cards_operator ON public.sim_cards(operator);
CREATE INDEX IF NOT EXISTS idx_sim_cards_assigned_to_employee ON public.sim_cards(assigned_to_employee_id);

CREATE TABLE IF NOT EXISTS public.sim_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sim_card_id UUID NOT NULL REFERENCES public.sim_cards(id) ON DELETE CASCADE,
  to_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sim_assignment_history_sim ON public.sim_assignment_history(sim_card_id);
CREATE INDEX IF NOT EXISTS idx_sim_assignment_history_employee ON public.sim_assignment_history(to_employee_id);

ALTER TABLE public.sim_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sim_cards_select ON public.sim_cards;
CREATE POLICY sim_cards_select ON public.sim_cards
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  );

DROP POLICY IF EXISTS sim_cards_all ON public.sim_cards;
CREATE POLICY sim_cards_all ON public.sim_cards
  FOR ALL
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  );

DROP POLICY IF EXISTS sim_assignment_history_select ON public.sim_assignment_history;
CREATE POLICY sim_assignment_history_select ON public.sim_assignment_history
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  );

DROP POLICY IF EXISTS sim_assignment_history_insert ON public.sim_assignment_history;
CREATE POLICY sim_assignment_history_insert ON public.sim_assignment_history
  FOR INSERT
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  );

DROP POLICY IF EXISTS sim_assignment_history_update ON public.sim_assignment_history;
CREATE POLICY sim_assignment_history_update ON public.sim_assignment_history
  FOR UPDATE
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.assign') = true
  );

COMMENT ON TABLE public.sim_cards IS 'SIM inventory with current assignment to employees.';
COMMENT ON TABLE public.sim_assignment_history IS 'Assignment history of SIM cards to employees.';
