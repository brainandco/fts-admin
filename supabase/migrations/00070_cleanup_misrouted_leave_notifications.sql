-- Remove leave_request notifications mis-sent to employee-portal users (legacy bug: all
-- active non–super users received leave queue / final-decision copies).
-- Keeps rows meant for the recipient: self_submitted, admin_leave meta, or they are the approval requester.
--
-- Note: DELETE ... USING cannot reference the deleted table (n) inside JOIN ... ON; use WHERE + EXISTS instead.

DELETE FROM public.notifications n
WHERE EXISTS (
  SELECT 1
  FROM public.users_profile u
  WHERE u.id = n.recipient_user_id
    AND coalesce(u.employee_portal_only, false) = true
)
AND n.category = 'leave_request'
AND (n.meta->>'self_submitted') IS DISTINCT FROM 'true'
AND (n.meta->>'admin_leave') IS DISTINCT FROM 'true'
AND (
  n.body IN (
    'A leave request needs admin review and remarks.',
    'A leave request has been finally approved by super user.',
    'A leave request has been rejected by super user.'
  )
  OR (
    (n.meta ? 'approval_id')
    AND nullif(trim(n.meta->>'approval_id'), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.approvals a
      WHERE a.id = (trim(n.meta->>'approval_id'))::uuid
        AND a.requester_id IS DISTINCT FROM n.recipient_user_id
    )
  )
);
