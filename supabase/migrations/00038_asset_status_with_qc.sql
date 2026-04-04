-- Optional enum value for assets held by QC (inspection / handover). Safe if already added in Supabase UI.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'asset_status'
      AND e.enumlabel = 'With_QC'
  ) THEN
    ALTER TYPE public.asset_status ADD VALUE 'With_QC';
  END IF;
END $$;

COMMENT ON TYPE public.asset_status IS 'Asset lifecycle; With_QC = in QC custody for check/handover.';
