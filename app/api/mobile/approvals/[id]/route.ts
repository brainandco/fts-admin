import { NextResponse } from "next/server";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";
import { isAdminPortalLeaveRequest } from "@/lib/approvals/leave-workflow";
import { approvalCanAct, approvalRequiresComment } from "@/lib/mobile/approval-workflow";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** GET — single approval for Admin Lite mobile. */
export async function GET(req: Request, { params }: Params) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!ctx.canViewApprovals) {
    return NextResponse.json({ message: "You do not have access to approvals." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: approval } = await supabase
    .from("approvals")
    .select("id, approval_type, status, requester_id, created_at, payload_json, region_id, admin_comment, pm_comment")
    .eq("id", id)
    .maybeSingle();

  if (!approval) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: requester } = await supabase
    .from("users_profile")
    .select("full_name, email")
    .eq("id", approval.requester_id)
    .maybeSingle();

  const payload = (approval.payload_json as Record<string, unknown>) ?? {};
  const actor = {
    isSuper: ctx.isSuper,
    canApprove: ctx.canApprove,
    canReject: ctx.canReject,
  };
  const canAct = approvalCanAct(approval, actor);

  let leaveDays: number | null = null;
  if (approval.approval_type === "leave_request") {
    const fromD = String(payload.from_date ?? "");
    const toD = String(payload.to_date ?? "");
    leaveDays = leaveRequestTracking(fromD, toD, approval.status).requestedDays;
  }

  const nameFromPayload = (
    (payload.requester_display_name as string | undefined) ??
    (payload.requester_name as string | undefined)
  )?.trim();

  return NextResponse.json({
    id: approval.id,
    approvalType: approval.approval_type,
    status: approval.status,
    requesterName: nameFromPayload || requester?.full_name?.trim() || requester?.email || approval.requester_id,
    requesterEmail: requester?.email ?? null,
    createdAt: approval.created_at,
    canAct,
    requiresComment: approvalRequiresComment(approval, actor),
    isAdminPortalLeave:
      approval.approval_type === "leave_request" && isAdminPortalLeaveRequest(approval.payload_json),
    fromDate: (payload.from_date as string | undefined) ?? null,
    toDate: (payload.to_date as string | undefined) ?? null,
    leaveType: (payload.leave_type as string | undefined) ?? null,
    leaveDays,
    reason: (payload.reason as string | undefined) ?? null,
    assetDescription: (payload.asset_description as string | undefined) ?? null,
    adminComment: approval.admin_comment ?? null,
    pmComment: approval.pm_comment ?? null,
  });
}

/** PATCH — proxy to main approvals handler (approve / reject). */
export async function PATCH(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const body = await req.text();
  const forward = new Request(new URL(`/api/approvals/${id}`, req.url), {
    method: "PATCH",
    headers: req.headers,
    body,
  });
  const { PATCH: patchApproval } = await import("@/app/api/approvals/[id]/route");
  return patchApproval(forward, ctx);
}
