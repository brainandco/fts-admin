-- Asset return workflow: employee submits return + comment; PM/Admin processes -> Available / Under_Maintenance (with PM comment when not Available).

DO $$ BEGIN
  ALTER TYPE public.asset_status ADD VALUE 'Pending_Return';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.asset_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  employee_comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  pm_decision TEXT CHECK (pm_decision IS NULL OR pm_decision IN ('Available', 'Under_Maintenance')),
  pm_comment TEXT,
  processed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_return_requests_asset ON public.asset_return_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_return_requests_status ON public.asset_return_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_return_requests_region ON public.asset_return_requests(region_id);

CREATE UNIQUE INDEX IF NOT EXISTS asset_return_one_pending_per_asset
  ON public.asset_return_requests(asset_id)
  WHERE status = 'pending';

ALTER TABLE public.asset_return_requests ENABLE ROW LEVEL SECURITY;

-- Admin users (JWT): read return requests if they can manage assets or process returns
DROP POLICY IF EXISTS asset_return_requests_select_admin ON public.asset_return_requests;
CREATE POLICY asset_return_requests_select_admin ON public.asset_return_requests
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.return') = true
  );

DROP POLICY IF EXISTS asset_return_requests_update_admin ON public.asset_return_requests;
CREATE POLICY asset_return_requests_update_admin ON public.asset_return_requests
  FOR UPDATE
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.return') = true
  )
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('assets.manage') = true
    OR public.fts_is_super_or_has_permission('assets.return') = true
  );

COMMENT ON TABLE public.asset_return_requests IS 'Employee-initiated asset returns; PM/Admin sets final status and comments.';
