-- PP final reports path is Region → Operator → Account → Project (regions from public.regions).

COMMENT ON TABLE public.pp_report_operators IS
  'Lookup: operator folder under Region in each PP reporter final-reports path.';
COMMENT ON TABLE public.pp_report_accounts IS
  'Lookup: account folder under Operator in each PP reporter final-reports path.';
COMMENT ON TABLE public.pp_report_projects IS
  'Lookup: project folder under Account in each PP reporter final-reports path; scoped to operator.';

-- PP / Reporting Team need all regions for final-reports folder hierarchy (not only home region).
DROP POLICY IF EXISTS regions_select_reporting_portal ON public.regions;
CREATE POLICY regions_select_reporting_portal ON public.regions
  FOR SELECT
  USING (public.fts_is_reporting_portal_employee() = true);
