-- Teams can be created without project/region; assign later on Region & project assignments page.

ALTER TABLE public.teams ALTER COLUMN project_id DROP NOT NULL;
