-- Expo push tokens for FTS mobile apps (employee + admin lite).
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT,
  app_variant TEXT NOT NULL DEFAULT 'employee',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_device_tokens_user_token_unique UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user ON public.push_device_tokens(user_id);

ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_device_tokens_select_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_select_own ON public.push_device_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_device_tokens_insert_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_insert_own ON public.push_device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_device_tokens_update_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_update_own ON public.push_device_tokens
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_device_tokens_delete_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_delete_own ON public.push_device_tokens
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_device_tokens TO authenticated;
GRANT ALL ON public.push_device_tokens TO service_role;

COMMENT ON TABLE public.push_device_tokens IS 'Expo push notification tokens for FTS mobile apps.';
