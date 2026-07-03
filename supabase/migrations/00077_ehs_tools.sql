-- EHS Tools: safety equipment tracked separately from regular assets (same assets table).

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS is_ehs_tool BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ehs_wear_role TEXT CHECK (ehs_wear_role IS NULL OR ehs_wear_role IN ('dt', 'driver_rigger')),
  ADD COLUMN IF NOT EXISTS ehs_tool_type TEXT,
  ADD COLUMN IF NOT EXISTS en_code TEXT,
  ADD COLUMN IF NOT EXISTS ehs_for_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_is_ehs_tool ON public.assets(is_ehs_tool) WHERE is_ehs_tool = true;
CREATE INDEX IF NOT EXISTS idx_assets_ehs_for_employee ON public.assets(ehs_for_employee_id) WHERE ehs_for_employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_ehs_tool_type ON public.assets(ehs_tool_type) WHERE ehs_tool_type IS NOT NULL;

COMMENT ON COLUMN public.assets.is_ehs_tool IS 'True for EHS safety tools (shoes, harness, etc.) — separate from regular assets UI.';
COMMENT ON COLUMN public.assets.ehs_wear_role IS 'Who wears the tool: dt (DT own) or driver_rigger (assigned to DT, worn by team driver).';
COMMENT ON COLUMN public.assets.ehs_tool_type IS 'Canonical EHS tool type key (safety_shoe, double_lanyard, …).';
COMMENT ON COLUMN public.assets.en_code IS 'Unified EN standard code for this tool type (same for all units of that type).';
COMMENT ON COLUMN public.assets.ehs_for_employee_id IS 'When ehs_wear_role=driver_rigger, the team driver/rigger this tool is for.';
