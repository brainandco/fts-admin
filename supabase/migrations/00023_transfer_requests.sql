CREATE TABLE IF NOT EXISTS public.transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('vehicle_swap', 'vehicle_replacement', 'drive_swap', 'asset_transfer')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  requester_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requester_region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE RESTRICT,
  target_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  target_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  request_reason TEXT NOT NULL,
  notes TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON public.transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_type ON public.transfer_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_requester ON public.transfer_requests(requester_employee_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_region ON public.transfer_requests(requester_region_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_created ON public.transfer_requests(created_at DESC);
