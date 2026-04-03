CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT
  USING (
    recipient_user_id = auth.uid()
    OR public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('users.view') = true
  );

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('users.edit') = true
    OR public.fts_is_super_or_has_permission('approvals.approve') = true
    OR public.fts_is_super_or_has_permission('approvals.reject') = true
    OR recipient_user_id = auth.uid()
  );

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE
  USING (
    recipient_user_id = auth.uid()
    OR public.fts_is_super_user() = true
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    OR public.fts_is_super_user() = true
  );

COMMENT ON TABLE public.notifications IS 'In-app notification inbox for users.';
