-- Employee inbox = only rows where they are the recipient (enforced by app inserts + queries).
-- Admins with `users.view` may still SELECT all notification rows for support / exports (same as 00022).

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT
  USING (
    recipient_user_id = auth.uid()
    OR public.fts_is_super_user() = true
    OR public.fts_is_super_or_has_permission('users.view') = true
  );
