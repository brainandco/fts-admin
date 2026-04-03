-- Profile pictures: URL on profile rows + public storage bucket scoped by auth user id.

ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.users_profile.avatar_url IS 'Public URL for profile image (Supabase Storage avatars bucket).';
COMMENT ON COLUMN public.employees.avatar_url IS 'Public URL for profile image (Supabase Storage avatars bucket).';

-- Storage bucket (public read; writes limited to own folder by auth uid)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies on storage.objects
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Employees may update their own row for profile fields (email/HR fields still admin-only via service role in app)
DROP POLICY IF EXISTS employees_update_self ON public.employees;
CREATE POLICY employees_update_self ON public.employees FOR UPDATE TO authenticated
  USING (
    public.fts_auth_user_email() IS NOT NULL
    AND LOWER(TRIM(COALESCE(employees.email, ''))) = LOWER(TRIM(public.fts_auth_user_email()))
  )
  WITH CHECK (
    public.fts_auth_user_email() IS NOT NULL
    AND LOWER(TRIM(COALESCE(employees.email, ''))) = LOWER(TRIM(public.fts_auth_user_email()))
  );

-- When an employee updates their own row (not super / not service role), only allow profile-oriented fields.
CREATE OR REPLACE FUNCTION public.employees_enforce_self_update_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF public.fts_is_super_user() THEN
    RETURN NEW;
  END IF;
  IF COALESCE(auth.jwt()->>'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.fts_auth_user_email() IS NULL
     OR LOWER(TRIM(OLD.email)) IS DISTINCT FROM LOWER(TRIM(public.fts_auth_user_email())) THEN
    RETURN NEW;
  END IF;
  NEW.employee_code := OLD.employee_code;
  NEW.email := OLD.email;
  NEW.region_id := OLD.region_id;
  NEW.project_id := OLD.project_id;
  NEW.project_name_other := OLD.project_name_other;
  NEW.status := OLD.status;
  NEW.passport_number := OLD.passport_number;
  NEW.iqama_number := OLD.iqama_number;
  NEW.country := OLD.country;
  NEW.department := OLD.department;
  NEW.job_title := OLD.job_title;
  NEW.onboarding_date := OLD.onboarding_date;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_enforce_self_update ON public.employees;
CREATE TRIGGER employees_enforce_self_update
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.employees_enforce_self_update_fields();
