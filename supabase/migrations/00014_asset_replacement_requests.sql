-- QC requests replacement/action from PM when an asset is not OK for use.
-- PM fulfills by assigning a new asset to the employee.

CREATE TABLE IF NOT EXISTS asset_replacement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  for_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_by_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fulfilled', 'Rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  replacement_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_status ON asset_replacement_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_requested_by ON asset_replacement_requests(requested_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_for_employee ON asset_replacement_requests(for_employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_replacement_requests_created ON asset_replacement_requests(created_at DESC);

ALTER TABLE asset_replacement_requests ENABLE ROW LEVEL SECURITY;

-- Only service role / admin access; employee portal uses getDataClient() (service role).
-- No per-role policies so anon cannot read; app enforces QC/PM in API.
