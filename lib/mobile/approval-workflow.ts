import { isAdminPortalLeaveRequest } from "@/lib/approvals/leave-workflow";

export type ApprovalRow = {
  id: string;
  approval_type: string;
  status: string;
  requester_id: string;
  created_at: string;
  payload_json: unknown;
  region_id: string | null;
};

export type ApprovalActor = {
  isSuper: boolean;
  canApprove: boolean;
  canReject: boolean;
};

export function approvalCanAct(approval: ApprovalRow, actor: ApprovalActor): boolean {
  const { isSuper, canApprove } = actor;
  const isAdminNonSuper = !isSuper && canApprove;
  const adminPortalLeave =
    approval.approval_type === "leave_request" && isAdminPortalLeaveRequest(approval.payload_json);

  if (approval.approval_type === "leave_request") {
    if (adminPortalLeave && approval.status === "Submitted" && isSuper) return true;
    if (!adminPortalLeave && approval.status === "Submitted" && isAdminNonSuper) return true;
    if (!adminPortalLeave && approval.status === "Performa_Submitted" && isSuper) return true;
    return false;
  }

  if (approval.approval_type === "asset_request") {
    if (approval.status === "Submitted" && isAdminNonSuper) return true;
    if (approval.status === "Admin_Approved" && isSuper) return true;
    return false;
  }

  return false;
}

export function approvalRequiresComment(_approval: ApprovalRow, _actor: ApprovalActor): boolean {
  return true;
}
