import { NextResponse } from "next/server";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";
import { isAdminPortalLeaveRequest } from "@/lib/approvals/leave-workflow";
import { approvalCanAct } from "@/lib/mobile/approval-workflow";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

function requesterName(
  approval: { requester_id: string; payload_json: unknown },
  profileById: Map<string, { full_name: string | null; email: string | null }>,
  emailToEmployeeName: Map<string, string>
) {
  const payload =
    (approval.payload_json as {
      requester_name?: string | null;
      requester_display_name?: string | null;
    }) ?? {};
  const nameFromPayload = (payload.requester_display_name ?? payload.requester_name)?.trim();
  const prof = profileById.get(approval.requester_id);
  const viaEmployee = prof?.email ? emailToEmployeeName.get(prof.email.trim().toLowerCase()) : undefined;
  return (
    nameFromPayload ||
    (prof?.full_name ?? "").trim() ||
    viaEmployee ||
    prof?.email ||
    approval.requester_id
  );
}

/** GET — approvals list for Admin Lite mobile. */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!ctx.canViewApprovals) {
    return NextResponse.json({ message: "You do not have access to approvals." }, { status: 403 });
  }

  const supabase = await getDataClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, approval_type, status, requester_id, created_at, payload_json, region_id")
    .order("created_at", { ascending: false })
    .limit(100);

  const userIds = [...new Set((approvals ?? []).map((a) => a.requester_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("users_profile").select("id, full_name, email").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rawEmails = [...new Set((profiles ?? []).map((p) => (p.email ?? "").trim()).filter(Boolean))];
  const { data: employeesMatch } =
    rawEmails.length > 0
      ? await supabase.from("employees").select("email, full_name").in("email", rawEmails)
      : { data: [] as { email: string; full_name: string | null }[] };
  const emailToEmployeeName = new Map<string, string>();
  for (const row of employeesMatch ?? []) {
    const em = (row.email ?? "").trim().toLowerCase();
    const fn = (row.full_name ?? "").trim();
    if (em && fn) emailToEmployeeName.set(em, fn);
  }

  const actor = {
    isSuper: ctx.isSuper,
    canApprove: ctx.canApprove,
    canReject: ctx.canReject,
  };

  const items = (approvals ?? []).map((a) => {
    const payload =
      (a.payload_json as {
        from_date?: string;
        to_date?: string;
        reason?: string;
        leave_type?: string;
        asset_description?: string;
      }) ?? {};
    const canAct = approvalCanAct(a, actor);
    let summary = "";
    if (a.approval_type === "leave_request") {
      const fromD = payload.from_date ?? "";
      const toD = payload.to_date ?? "";
      const { requestedDays } = leaveRequestTracking(fromD, toD, a.status);
      summary = [payload.leave_type, fromD && toD ? `${fromD} → ${toD}` : "", requestedDays ? `${requestedDays} day(s)` : ""]
        .filter(Boolean)
        .join(" · ");
    } else if (a.approval_type === "asset_request") {
      summary = payload.asset_description?.trim() || payload.reason?.trim() || "";
    }

    return {
      id: a.id,
      approvalType: a.approval_type,
      status: a.status,
      requesterName: requesterName(a, profileById, emailToEmployeeName),
      createdAt: a.created_at,
      summary,
      canAct,
      isAdminPortalLeave:
        a.approval_type === "leave_request" && isAdminPortalLeaveRequest(a.payload_json),
      fromDate: payload.from_date ?? null,
      toDate: payload.to_date ?? null,
      reason: payload.reason ?? null,
      leaveType: payload.leave_type ?? null,
    };
  });

  const pendingActionCount = items.filter((i) => i.canAct).length;

  return NextResponse.json({ items, pendingActionCount, total: items.length });
}
