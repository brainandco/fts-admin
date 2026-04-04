import type { SupabaseClient } from "@supabase/supabase-js";

export type UserDependencyBlock = {
  key: string;
  label: string;
  count: number;
  action: string;
};

export type UserDependenciesResult = {
  canDeleteOrDisable: boolean;
  blocks: UserDependencyBlock[];
  message: string;
};

export type GetUserDependenciesOptions = {
  /** When deleting an employee, do not block on approvals (any status) tied to their portal user. User management still checks approvals by default. */
  skipApprovals?: boolean;
};

/**
 * Check if a user has any assignments or related data that must be unassigned
 * before the user can be deleted or disabled. Use before DELETE or setting status to DISABLED.
 */
export async function getUserDependencies(
  supabase: SupabaseClient,
  userId: string,
  options?: GetUserDependenciesOptions
): Promise<UserDependenciesResult> {
  const blocks: UserDependencyBlock[] = [];

  // Assets assigned to this user
  const { count: assetsCount } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to_user_id", userId);
  if ((assetsCount ?? 0) > 0) {
    blocks.push({
      key: "assets",
      label: "Assets",
      count: assetsCount ?? 0,
      action: "Unassign or reassign all assets to another user (Assets).",
    });
  }

  // Vehicles assigned to this user (column may not exist in some schemas)
  try {
    const { count: vehiclesCount } = await supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_user_id", userId);
    if ((vehiclesCount ?? 0) > 0) {
      blocks.push({
        key: "vehicles",
        label: "Vehicles",
        count: vehiclesCount ?? 0,
        action: "Unassign or reassign all vehicles to another user/employee (Vehicles).",
      });
    }
  } catch {
    // Column or table may not exist
  }

  // Tasks: created by, assigned to PM, or assigned to user
  const { count: tasksCreated } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);
  const { count: tasksAssignedPm } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to_pm_id", userId);
  const { count: tasksAssignedUser } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to_user_id", userId);
  const tasksTotal = (tasksCreated ?? 0) + (tasksAssignedPm ?? 0) + (tasksAssignedUser ?? 0);
  if (tasksTotal > 0) {
    blocks.push({
      key: "tasks",
      label: "Tasks",
      count: tasksTotal,
      action: "Reassign or close all tasks where this user is creator or assignee (Tasks).",
    });
  }

  // Task assignments (user_id) – table may not exist in all schemas
  try {
    const { count: taskAssignmentsCount } = await supabase
      .from("task_assignments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((taskAssignmentsCount ?? 0) > 0) {
      blocks.push({
        key: "task_assignments",
        label: "Task assignments",
        count: taskAssignmentsCount ?? 0,
        action: "Remove this user from all task assignments (Tasks).",
      });
    }
  } catch {
    // Table may not exist
  }

  // Approvals requested by this user (optional skip when removing employee + linked portal account)
  if (!options?.skipApprovals) {
    const { count: approvalsCount } = await supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", userId);
    if ((approvalsCount ?? 0) > 0) {
      blocks.push({
        key: "approvals",
        label: "Approvals",
        count: approvalsCount ?? 0,
        action: "Resolve or reassign approval requests created by this user (Approvals).",
      });
    }
  }

  // Team members
  const { count: teamMembersCount } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((teamMembersCount ?? 0) > 0) {
    blocks.push({
      key: "team_members",
      label: "Team membership",
      count: teamMembersCount ?? 0,
      action: "Remove this user from all teams (Teams).",
    });
  }

  // Delegations (as delegator or delegatee)
  const { count: delegationsAsDelegator } = await supabase
    .from("delegations")
    .select("id", { count: "exact", head: true })
    .eq("delegator_user_id", userId);
  const { count: delegationsAsDelegatee } = await supabase
    .from("delegations")
    .select("id", { count: "exact", head: true })
    .eq("delegatee_user_id", userId);
  const delegationsTotal = (delegationsAsDelegator ?? 0) + (delegationsAsDelegatee ?? 0);
  if (delegationsTotal > 0) {
    blocks.push({
      key: "delegations",
      label: "Delegations",
      count: delegationsTotal,
      action: "Remove or transfer all delegations where this user is delegator or delegatee (Delegate).",
    });
  }

  // Projects pm_user_id (column may not exist)
  try {
    const { count: projectsCount } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("pm_user_id", userId);
    if ((projectsCount ?? 0) > 0) {
      blocks.push({
        key: "projects",
        label: "Projects (PM)",
        count: projectsCount ?? 0,
        action: "Assign another PM to these projects (Projects).",
      });
    }
  } catch {
    // Column may not exist
  }

  const canDeleteOrDisable = blocks.length === 0;
  const message = canDeleteOrDisable
    ? ""
    : [
        "This user cannot be deleted or disabled until the following are resolved:",
        ...blocks.map((b) => `• ${b.label}: ${b.count} — ${b.action}`),
        "After everything above is unassigned or transferred, you can delete or disable the user.",
      ].join("\n");

  return { canDeleteOrDisable, blocks, message };
}
