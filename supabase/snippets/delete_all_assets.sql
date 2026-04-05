-- Destructive: delete every asset (including assigned). Run in Supabase SQL Editor with a role that bypasses RLS.
-- Order: receipt confirmations (no FK to assets) then assets (CASCADE cleans assignment history, return requests, etc.).
-- transfer_requests.asset_id is ON DELETE SET NULL.

BEGIN;

DELETE FROM public.resource_receipt_confirmations
WHERE resource_type = 'asset';

DELETE FROM public.assets;

COMMIT;
