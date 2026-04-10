/** Admin-portal leave: one Super User approve/reject (no performa / employee workflow). */
export function isAdminPortalLeaveRequest(payloadJson: unknown): boolean {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return false;
  return (payloadJson as Record<string, unknown>).admin_leave_request === true;
}
