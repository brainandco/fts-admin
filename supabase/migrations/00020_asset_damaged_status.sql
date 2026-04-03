-- Add a non-repairable asset outcome from return workflow.
DO $$
BEGIN
  ALTER TYPE public.asset_status ADD VALUE 'Damaged';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow PM return decisions to mark an asset as Damaged.
ALTER TABLE public.asset_return_requests
  DROP CONSTRAINT IF EXISTS asset_return_requests_pm_decision_check;

ALTER TABLE public.asset_return_requests
  ADD CONSTRAINT asset_return_requests_pm_decision_check
  CHECK (pm_decision IS NULL OR pm_decision IN ('Available', 'Under_Maintenance', 'Damaged'));
