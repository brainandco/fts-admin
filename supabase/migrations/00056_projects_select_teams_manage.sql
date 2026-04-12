-- Team managers need to read project names for teams they manage (Teams list, etc.).
-- Previously projects_select only allowed super, projects.manage, or PM of the project's region.

DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT USING (
  public.fts_is_super_user() = true
  OR public.fts_is_super_or_has_permission('projects.manage') = true
  OR public.fts_is_pm_of_region(region_id) = true
  OR (
    public.fts_is_super_or_has_permission('teams.manage') = true
    AND id IN (SELECT t.project_id FROM public.teams t WHERE t.project_id IS NOT NULL)
  )
);
