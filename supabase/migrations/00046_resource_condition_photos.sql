-- Condition photos: at least 2 images when recording purchase state for assets/vehicles,
-- and when employees return assets or vehicles (audit trail).

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS purchase_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS purchase_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.assets.purchase_image_urls IS 'Public storage URLs (JSON array, min 2 when creating/editing via UI).';
COMMENT ON COLUMN public.vehicles.purchase_image_urls IS 'Public storage URLs (JSON array, min 2 when creating/editing via UI).';

ALTER TABLE public.asset_return_requests
  ADD COLUMN IF NOT EXISTS return_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.asset_return_requests.return_image_urls IS 'Photos at hand-in (JSON array, min 2 required on submit).';

CREATE TABLE IF NOT EXISTS public.vehicle_return_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  from_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_comment TEXT NOT NULL,
  return_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_return_events_vehicle ON public.vehicle_return_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_return_events_created ON public.vehicle_return_events(created_at DESC);

COMMENT ON TABLE public.vehicle_return_events IS 'Driver vehicle hand-ins with condition photos (min 2 images per event).';

ALTER TABLE public.vehicle_return_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_return_events_select_staff ON public.vehicle_return_events;
CREATE POLICY vehicle_return_events_select_staff ON public.vehicle_return_events
  FOR SELECT
  USING (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('vehicles.manage') = true
  );

-- Public bucket: reads allowed; writes only via service role in app APIs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resource-photos',
  'resource-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "resource_photos_select_public" ON storage.objects;
CREATE POLICY "resource_photos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resource-photos');
