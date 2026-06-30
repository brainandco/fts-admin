-- Granular permission to terminate (delete) teams. Assign via Settings → Roles & permissions.

INSERT INTO public.permissions (code, name, module)
VALUES ('teams.terminate', 'Terminate teams', 'teams')
ON CONFLICT (code) DO NOTHING;

DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete ON public.teams FOR DELETE USING (
  public.fts_is_super_user() = true
  OR public.fts_is_super_or_has_permission('teams.terminate') = true
);
