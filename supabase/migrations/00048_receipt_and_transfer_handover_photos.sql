-- Receipt confirmation: condition photos when assignee confirms (assets: min 2 enforced in app).
-- Transfer: handover photos when requesting asset transfer to another employee (min 2 in app).

ALTER TABLE public.resource_receipt_confirmations
  ADD COLUMN IF NOT EXISTS receipt_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.resource_receipt_confirmations.receipt_image_urls IS
  'Public storage URLs (JSON array); at least 2 required on confirm for resource_type = asset.';

ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS handover_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.transfer_requests.handover_image_urls IS
  'Photos of asset condition at handover (JSON array); at least 2 required when request_type = asset_transfer.';
