-- Unique business code per team for segregation (reporting, filtering, integrations).

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_code TEXT;

COMMENT ON COLUMN public.teams.team_code IS
  'Unique code for segregating teams (e.g. T-R01). Normalized to uppercase in application.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_team_code_unique
  ON public.teams (team_code)
  WHERE team_code IS NOT NULL AND btrim(team_code) <> '';
