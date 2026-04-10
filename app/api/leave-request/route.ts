import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireActive } from "@/lib/rbac/permissions";
import { inclusiveCalendarDays } from "@/lib/employee-requests/leave-metrics";
import { auditLog } from "@/lib/audit/log";

/**
 * POST /api/leave-request — admin portal user submits leave (no guarantor, no performa).
 * Super User single-step approval only (see PATCH /api/approvals/[id]).
 */
export async function POST(req: Request) {
  const access = await requireActive();
  if (!access.allowed) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const from_date = typeof body.from_date === "string" ? body.from_date.trim() : "";
  const to_date = typeof body.to_date === "string" ? body.to_date.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const leave_type = typeof body.leave_type === "string" ? body.leave_type.trim() : "";

  if (!from_date || !to_date) {
    return NextResponse.json({ message: "From date and to date are required" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ message: "Reason is required" }, { status: 400 });
  }
  if (!leave_type) {
    return NextResponse.json({ message: "Leave type is required" }, { status: 400 });
  }

  const from = new Date(from_date);
  const to = new Date(to_date);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ message: "Invalid date format" }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ message: "To date must be on or after from date" }, { status: 400 });
  }

  const profile = access.profile;
  const userId = access.user.id;
  const displayName = (profile.full_name ?? "").trim() || profile.email || userId;
  const total_days = inclusiveCalendarDays(from_date, to_date);

  const payload_json = {
    from_date,
    to_date,
    reason,
    leave_type,
    admin_leave_request: true,
    requester_display_name: displayName,
    requester_name: profile.full_name ?? null,
    leave_total_days_snapshot: total_days,
  };

  const supabase = await getDataClient();
  const { data: approval, error } = await supabase
    .from("approvals")
    .insert({
      approval_type: "leave_request",
      status: "Submitted",
      requester_id: userId,
      region_id: null,
      payload_json,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  const { data: supers } = await supabase
    .from("users_profile")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("is_super_user", true);
  const superRows = (supers ?? [])
    .filter((p) => p.id !== userId)
    .map((p) => ({
      recipient_user_id: p.id,
      title: "Admin leave request pending",
      body: `${displayName} submitted a leave request (Super User approval required).`,
      category: "leave_request",
      link: `/approvals/${approval.id}`,
      meta: { approval_id: approval.id, from_date, to_date, admin_leave: true },
    }));
  if (superRows.length > 0) {
    await supabase.from("notifications").insert(superRows);
  }

  await auditLog({
    actionType: "create",
    entityType: "approval",
    entityId: approval.id,
    newValue: { approval_type: "leave_request", status: "Submitted", admin_leave_request: true },
    description: "Admin portal leave request submitted",
  });

  return NextResponse.json({ id: approval.id, message: "Leave request submitted" });
}
