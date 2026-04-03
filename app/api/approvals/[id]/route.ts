import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action;
  const comment = body.comment ?? "";
  if (!["approve", "reject"].includes(action)) return NextResponse.json({ message: "action must be approve or reject" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: approval } = await supabase.from("approvals").select("*").eq("id", id).single();
  if (!approval) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { profile } = await getCurrentUserProfile();
  const isPm = approval.region_id && profile?.region_id === approval.region_id;
  const canApprove = await can("approvals.approve");
  const isSuper = profile?.is_super_user === true;
  const isAdminNonSuper = !isSuper && canApprove;

  let newStatus: string;
  let updates: Record<string, unknown> = {};

  if (approval.approval_type === "leave_request") {
    if (approval.status === "Submitted" && isAdminNonSuper) {
      if (!String(comment).trim()) {
        return NextResponse.json({ message: "Admin remarks are required for leave requests" }, { status: 400 });
      }
      newStatus = action === "approve" ? "Admin_Approved" : "Admin_Rejected";
      updates = {
        status: newStatus,
        admin_acted_at: new Date().toISOString(),
        admin_acted_by: profile?.id,
        admin_comment: comment,
      };
    } else if (approval.status === "Admin_Approved" && isSuper) {
      if (!String(comment).trim()) {
        return NextResponse.json({ message: "Super user remarks are required for final leave decision" }, { status: 400 });
      }
      newStatus = action === "approve" ? "Completed" : "PM_Rejected";
      updates = {
        status: newStatus,
        pm_acted_at: new Date().toISOString(),
        pm_acted_by: profile?.id,
        pm_comment: comment,
      };
    } else {
      return NextResponse.json({ message: "Forbidden or invalid state for leave workflow" }, { status: 403 });
    }
  } else if (approval.status === "Submitted" && isPm) {
    newStatus = action === "approve" ? "PM_Approved" : "PM_Rejected";
    updates = { status: newStatus, pm_acted_at: new Date().toISOString(), pm_acted_by: profile?.id, pm_comment: comment };
  } else if ((approval.status === "PM_Approved" || approval.status === "Submitted") && (isSuper || canApprove)) {
    newStatus = action === "approve" ? (approval.admin_final_approver_enabled ? "Admin_Approved" : "Completed") : "Admin_Rejected";
    if (newStatus === "Admin_Approved") newStatus = "Completed";
    updates = { status: newStatus, admin_acted_at: new Date().toISOString(), admin_acted_by: profile?.id, admin_comment: comment };
  } else {
    return NextResponse.json({ message: "Forbidden or invalid state" }, { status: 403 });
  }

  const { error } = await supabase.from("approvals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  // Notifications for leave workflow.
  if (approval.approval_type === "leave_request") {
    if (approval.status === "Submitted" && newStatus === "Admin_Rejected") {
      await supabase.from("notifications").insert({
        recipient_user_id: approval.requester_id,
        title: "Leave request rejected by Admin",
        body: "Your leave request was rejected at admin review stage.",
        category: "leave_request",
        link: "/leave",
        meta: { approval_id: id, final_status: newStatus },
      });
    }
    if (approval.status === "Submitted" && newStatus === "Admin_Approved") {
      const { data: supers } = await supabase
        .from("users_profile")
        .select("id")
        .eq("status", "ACTIVE")
        .eq("is_super_user", true);
      const rows = (supers ?? []).map((u) => ({
        recipient_user_id: u.id,
        title: "Leave request requires final review",
        body: "Admin reviewed and approved a leave request. Final super-user decision is needed.",
        category: "leave_request",
        link: `/approvals/${id}`,
        meta: { approval_id: id, stage: "super_review" },
      }));
      if (rows.length) await supabase.from("notifications").insert(rows);
      await supabase.from("notifications").insert({
        recipient_user_id: approval.requester_id,
        title: "Leave request moved to final approval",
        body: "Admin reviewed your leave request. It is now pending super-user final decision.",
        category: "leave_request",
        link: "/leave",
        meta: { approval_id: id, stage: "super_review" },
      });
    }
    if (approval.status === "Admin_Approved" && (newStatus === "Completed" || newStatus === "PM_Rejected")) {
      const { data: admins } = await supabase
        .from("users_profile")
        .select("id")
        .eq("status", "ACTIVE")
        .eq("is_super_user", false);
      const adminRows = (admins ?? []).map((u) => ({
        recipient_user_id: u.id,
        title: "Leave request final decision",
        body: newStatus === "Completed" ? "A leave request has been finally approved by super user." : "A leave request has been rejected by super user.",
        category: "leave_request",
        link: `/approvals/${id}`,
        meta: { approval_id: id, final_status: newStatus },
      }));
      const requesterRow = {
        recipient_user_id: approval.requester_id,
        title: "Your leave request was updated",
        body: newStatus === "Completed" ? "Your leave request is approved." : "Your leave request was rejected.",
        category: "leave_request",
        link: "/leave",
        meta: { approval_id: id, final_status: newStatus },
      };
      await supabase.from("notifications").insert([...adminRows, requesterRow]);
    }
  }

  await auditLog({ actionType: action === "approve" ? "approval_approved" : "approval_rejected", entityType: "approval", entityId: id, newValue: updates, description: `Approval ${action}` });
  return NextResponse.json({ ok: true });
}
