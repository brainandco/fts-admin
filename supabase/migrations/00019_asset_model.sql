-- Manufacturer / SKU model designation (e.g. Latitude 5520, SM-G991B).
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS model TEXT;

COMMENT ON COLUMN public.assets.model IS 'Item model name or number (distinct from display name and serial).';
