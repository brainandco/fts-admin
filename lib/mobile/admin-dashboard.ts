import type { SupabaseClient } from "@supabase/supabase-js";
import { approvalCanAct, type ApprovalRow } from "@/lib/mobile/approval-workflow";
import type { ApiAuthContext } from "@/lib/mobile/api-auth-context";
import { pmEmployeeIdSet } from "@/lib/employees/pm-role";
import type { UsersProfileWithRegion } from "@/lib/types/database";

export type AdminMobileDashboard = {
  fullName: string | null;
  unreadNotifications: number;
  queues: {
    approvalsNeedAction: number;
    leavePending: number;
    assetRequestsPending: number;
    assetReturnsPending: number;
    profileUpdatesPending: number;
    openDutyShifts: number;
    overdueTasks: number;
  };
  access: {
    canViewApprovals: boolean;
    canManageAssets: boolean;
    canManageEmployees: boolean;
    canViewVehicleDuty: boolean;
    canViewTasks: boolean;
    canViewInventory: boolean;
  };
};

async function safeCount(
  fn: () => PromiseLike<{ count: number | null }> | Promise<{ count: number | null }>
): Promise<number> {
  try {
    const { count } = await fn();
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function buildAdminMobileDashboard(
  ctx: ApiAuthContext,
  supabase: SupabaseClient
): Promise<AdminMobileDashboard> {
  const regionId = (ctx.profile as UsersProfileWithRegion).region_id ?? null;
  const actor = { isSuper: ctx.isSuper, canApprove: ctx.canApprove, canReject: ctx.canReject };

  const canViewApprovals = ctx.canViewApprovals;
  const canManageAssets = ctx.isSuper || ctx.permissions.has("assets.manage") || ctx.permissions.has("assets.return");
  const canManageEmployees = ctx.isSuper || ctx.permissions.has("employees.manage");
  const canViewVehicleDuty =
    ctx.isSuper || ctx.permissions.has("vehicles.manage") || ctx.permissions.has("vehicles.assign");
  const canViewTasks = ctx.isSuper || ctx.permissions.has("tasks.view_all") || ctx.permissions.has("tasks.edit");
  const canViewInventory =
    ctx.isSuper ||
    ctx.permissions.has("assets.manage") ||
    ctx.permissions.has("assets.assign") ||
    ctx.permissions.has("vehicles.manage") ||
    ctx.permissions.has("vehicles.assign");

  const unreadNotifications = await safeCount(() =>
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", ctx.userId)
      .eq("is_read", false)
  );

  let approvalsNeedAction = 0;
  let leavePending = 0;
  let assetRequestsPending = 0;

  if (canViewApprovals) {
    const { data: approvals } = await supabase
      .from("approvals")
      .select("id, approval_type, status, requester_id, created_at, payload_json, region_id")
      .order("created_at", { ascending: false })
      .limit(200);

    for (const row of (approvals ?? []) as ApprovalRow[]) {
      if (approvalCanAct(row, actor)) approvalsNeedAction += 1;
      if (row.approval_type === "leave_request" && ["Submitted", "Awaiting_Signed_Performa", "Performa_Submitted"].includes(row.status)) {
        leavePending += 1;
      }
      if (row.approval_type === "asset_request" && ["Submitted", "Admin_Approved"].includes(row.status)) {
        assetRequestsPending += 1;
      }
    }
  }

  let assetReturnsPending = 0;
  if (canManageAssets) {
    const { data: returns } = await supabase
      .from("asset_return_requests")
      .select("id, from_employee_id, status")
      .eq("status", "pending");
    const pmIds = await pmEmployeeIdSet(
      supabase,
      (returns ?? []).map((r) => r.from_employee_id as string)
    );
    assetReturnsPending = (returns ?? []).filter((r) => pmIds.has(r.from_employee_id as string)).length;
  }

  let profileUpdatesPending = 0;
  if (canManageEmployees) {
    profileUpdatesPending = await safeCount(() =>
      supabase
        .from("employee_profile_update_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    );
  }

  let openDutyShifts = 0;
  if (canViewVehicleDuty) {
    openDutyShifts = await safeCount(() =>
      supabase.from("vehicle_duty_shifts").select("id", { count: "exact", head: true }).eq("status", "open")
    );
  }

  let overdueTasks = 0;
  if (canViewTasks) {
    let q = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .lt("due_date", new Date().toISOString().slice(0, 10))
      .in("status", ["Draft", "Assigned_to_PM", "Assigned_to_User", "In_Progress", "Blocked"]);
    if (regionId && !ctx.isSuper) q = q.eq("region_id", regionId);
    overdueTasks = await safeCount(() => q);
  }

  return {
    fullName: ctx.profile.full_name ?? null,
    unreadNotifications,
    queues: {
      approvalsNeedAction,
      leavePending,
      assetRequestsPending,
      assetReturnsPending,
      profileUpdatesPending,
      openDutyShifts,
      overdueTasks,
    },
    access: {
      canViewApprovals,
      canManageAssets,
      canManageEmployees,
      canViewVehicleDuty,
      canViewTasks,
      canViewInventory,
    },
  };
}
