-- Allow creating employees before region is assigned (set on Region & project assignments page).

ALTER TABLE public.employees ALTER COLUMN region_id DROP NOT NULL;
