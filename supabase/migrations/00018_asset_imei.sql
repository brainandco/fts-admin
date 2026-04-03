-- Optional IMEI fields for mobile / dual-SIM devices (and similar cellular assets).
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS imei_1 TEXT,
  ADD COLUMN IF NOT EXISTS imei_2 TEXT;

COMMENT ON COLUMN public.assets.imei_1 IS 'Primary IMEI (e.g. mobile handset).';
COMMENT ON COLUMN public.assets.imei_2 IS 'Secondary IMEI when the device has dual SIM / second modem.';
