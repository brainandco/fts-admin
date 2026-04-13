import { findAuthUserIdByEmail, isAuthUserNotFoundMessage } from "@/lib/auth/find-auth-user-id-by-email";
import { auditLog } from "@/lib/audit/log";
import { getUserDependencies } from "@/lib/user-dependencies";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { getDataClient } from "@/lib/supabase/server";

const SUPER_ROLE_ID = "a0000000-0000-0000-0000-000000000000";

type DataClient = Awaited<ReturnType<typeof getDataClient>>;

export async function findPortalProfileByEmployeeEmail(
  supabase: DataClient,
  emailRaw: string | null
): Promise<{ id: string; is_super_user: boolean | null } | null> {
  const em = (emailRaw ?? "").trim();
  if (!em) return null;
  const { data: exact } = await supabase.from("users_profile").select("id, is_super_user").eq("email", em).maybeSingle();
  if (exact) return exact;
  const { data: ci } = await supabase.from("users_profile").select("id, is_super_user").ilike("email", em).maybeSingle();
  return ci;
}

export type DeleteEmployeeResult =
  | { ok: true }
  | { ok: false; status: number; message: string; code?: string; teams?: { id: string; name: string }[]; blocks?: unknown };

/**
 * Same rules as DELETE /api/employees/[id]. Used by that route and bulk-delete.
 * Removes linked auth user, user_roles, and users_profile when the employee had portal access.
 */
export async function deleteEmployeeById(id: string): Promise<DeleteEmployeeResult> {
  const supabase = await getDataClient();
  const { data: old } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!old) return { ok: false, status: 404, message: "Not found" };

  const { data: teamsUsingEmployee } = await supabase
    .from("teams")
    .select("id, name")
    .or(`dt_employee_id.eq.${id},driver_rigger_employee_id.eq.${id}`);
  if (teamsUsingEmployee && teamsUsingEmployee.length > 0) {
    return {
      ok: false,
      status: 400,
      message:
        "This employee is assigned to one or more teams. To delete this employee, you must first replace them in every team where they are assigned. Go to each team, replace this member (DT or Driver/Rigger) with another employee, then delete the employee.",
      code: "EMPLOYEE_IN_USE_IN_TEAMS",
      teams: teamsUsingEmployee,
    };
  }

  const { count: vehicleAssignmentsCount } = await supabase
    .from("vehicle_assignments")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", id);
  if ((vehicleAssignmentsCount ?? 0) > 0) {
    return {
      ok: false,
      status: 400,
      message:
        "This employee has vehicles assigned. Unassign all vehicles from this employee (Vehicles → edit assignment) before deleting the employee.",
      code: "EMPLOYEE_HAS_VEHICLE_ASSIGNMENTS",
    };
  }

  const portalProfile = await findPortalProfileByEmployeeEmail(supabase, old.email as string | null);
  let resolvedUserId: string | null = portalProfile?.id ?? null;

  let admin: ReturnType<typeof createServerSupabaseAdmin> | null = null;
  const getAdmin = () => {
    if (!admin) admin = createServerSupabaseAdmin();
    return admin;
  };

  const emailStr = typeof old.email === "string" ? old.email.trim() : "";
  if (!resolvedUserId && emailStr) {
    try {
      resolvedUserId = await findAuthUserIdByEmail(getAdmin(), emailStr);
    } catch {
      resolvedUserId = null;
    }
  }

  if (resolvedUserId) {
    const { data: profileRow } = await supabase
      .from("users_profile")
      .select("id, is_super_user")
      .eq("id", resolvedUserId)
      .maybeSingle();

    if (profileRow?.is_super_user) {
      return {
        ok: false,
        status: 400,
        message:
          "This email is linked to the seeded Super User account. Remove or change that account separately; do not delete this employee record tied to Super.",
      };
    }
    const { data: superRoleRow } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", resolvedUserId)
      .eq("role_id", SUPER_ROLE_ID)
      .maybeSingle();
    if (superRoleRow) {
      return {
        ok: false,
        status: 400,
        message: "This person has the Super role in the admin portal. Remove that role from Users before deleting the employee.",
        code: "EMPLOYEE_HAS_SUPER_ROLE",
      };
    }
    const deps = await getUserDependencies(supabase, resolvedUserId, { skipApprovals: true });
    if (!deps.canDeleteOrDisable) {
      return {
        ok: false,
        status: 400,
        message: deps.message,
        code: "PORTAL_USER_HAS_DEPENDENCIES",
        blocks: deps.blocks,
      };
    }
  }

  if (resolvedUserId) {
    await supabase.from("user_roles").delete().eq("user_id", resolvedUserId);
    const { error: authDelErr } = await getAdmin().auth.admin.deleteUser(resolvedUserId);
    if (authDelErr && !isAuthUserNotFoundMessage(authDelErr.message)) {
      return {
        ok: false,
        status: 400,
        message:
          authDelErr.message ||
          "Could not remove this person’s portal login. Resolve the error above, then try deleting the employee again.",
      };
    }
    await supabase.from("users_profile").delete().eq("id", resolvedUserId);
  }

  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { ok: false, status: 400, message: error.message };

  await auditLog({
    actionType: "delete",
    entityType: "employee",
    entityId: id,
    oldValue: old,
    description: resolvedUserId ? "Employee and linked portal account removed" : "Employee deleted",
  });
  return { ok: true };
}
