-- Align RLS helpers with app logic: "Super" is users_profile.is_super_user OR assignment to the Super role.
-- Without this, super users who only have the Super role (flag false) cannot SELECT other users_profile rows
-- when using the authenticated Supabase client (no service role), so the Users list appears empty.

CREATE OR REPLACE FUNCTION public.fts_is_super_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT up.is_super_user FROM public.users_profile up WHERE up.id = auth.uid()),
    false
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role_id = 'a0000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.fts_is_super_or_has_permission(perm_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT public.fts_is_super_user()
  OR EXISTS (
    SELECT 1 FROM public.users_profile up
    LEFT JOIN public.user_roles ur ON ur.user_id = up.id
    LEFT JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id AND p.code = perm_code
    LEFT JOIN public.user_permission_overrides upo ON upo.user_id = up.id
    LEFT JOIN public.permissions p2 ON p2.id = upo.permission_id AND p2.code = perm_code
    WHERE up.id = auth.uid()
    AND (up.is_super_user OR (p.id IS NOT NULL AND (upo.id IS NULL OR upo.granted)) OR (upo.granted = true))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
