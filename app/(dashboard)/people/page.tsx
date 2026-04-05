import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import {
  countActiveAdminPortalUsers,
  getEmployeeEmailSet,
  getTotalFtsPeopleCount,
} from "@/lib/admin-portal-user-counts";
import { can, getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";
import { SUPER_ROLE_ID } from "@/lib/rbac/permissions";
import {
  FtsPeopleDirectory,
  type FtsAdminOnlyTableRow,
  type FtsEmployeeTableRow,
} from "@/components/people/FtsPeopleDirectory";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  is_super_user: boolean | null;
};

export default async function PeoplePage() {
  if (!(await can("users.view"))) redirect("/dashboard");

  const { isSuper } = await getCurrentUserRolesAndPermissions();
  const supabase = await getDataClient();

  const [employeesRes, regionsRes, profilesEmailRes, totalFtsPeople, activeAdminPortalOnly] = await Promise.all([
    supabase.from("employees").select("id, full_name, email, status, region_id").order("full_name"),
    supabase.from("regions").select("id, name"),
    supabase.from("users_profile").select("email"),
    getTotalFtsPeopleCount(supabase),
    countActiveAdminPortalUsers(supabase),
  ]);

  if (employeesRes.error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-rose-900 shadow-sm">
        <h1 className="text-lg font-semibold">Could not load employees</h1>
        <p className="mt-2 text-sm">{employeesRes.error.message}</p>
      </div>
    );
  }

  const regionMap = new Map((regionsRes.data ?? []).map((r) => [r.id, r.name]));
  const portalEmails = new Set(
    (profilesEmailRes.data ?? []).map((p) => (p.email ?? "").toLowerCase().trim()).filter(Boolean)
  );

  const employeeRows: FtsEmployeeTableRow[] = (employeesRes.data ?? []).map((e) => ({
    id: e.id,
    full_name: (e.full_name ?? "").trim() || "—",
    email: (e.email ?? "").trim() || "—",
    status: e.status ?? "—",
    region_name: e.region_id ? regionMap.get(e.region_id) ?? "—" : "—",
    has_portal_account: portalEmails.has((e.email ?? "").toLowerCase().trim()) ? "Yes" : "No",
  }));

  let adminRows: FtsAdminOnlyTableRow[] = [];

  if (isSuper) {
    const usersRes = await supabase
      .from("users_profile")
      .select("id, email, full_name, status, is_super_user, created_at")
      .order("email");

    if (usersRes.error) {
      return (
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-rose-900 shadow-sm">
          <h1 className="text-lg font-semibold">Could not load admin users</h1>
          <p className="mt-2 text-sm">{usersRes.error.message}</p>
        </div>
      );
    }

    const profiles = (usersRes.data ?? []) as ProfileRow[];
    const ids = profiles.map((p) => p.id);
    const superRoleUserIds = new Set<string>();

    if (ids.length > 0) {
      const { data: urData } = await supabase
        .from("user_roles")
        .select("user_id, role_id, roles(name)")
        .in("user_id", ids);
      for (const row of (urData ?? []) as { user_id: string; role_id: string; roles: unknown }[]) {
        if (row.role_id === SUPER_ROLE_ID) {
          superRoleUserIds.add(row.user_id);
        }
      }
    }

    const employeeEmails = await getEmployeeEmailSet(supabase);
    const adminOnly = profiles.filter((u) => {
      const em = (u.email ?? "").toLowerCase().trim();
      if (!em || employeeEmails.has(em)) return false;
      return u.status === "ACTIVE";
    });

    adminRows = adminOnly.map((u) => {
      const isSuperFlag = Boolean(u.is_super_user);
      const hasSuperRole = superRoleUserIds.has(u.id);
      const has_super_access = isSuperFlag || hasSuperRole;
      return {
        id: u.id,
        full_name: (u.full_name ?? "").trim() || "—",
        email: u.email ?? "",
        status: u.status,
        super_access: has_super_access ? "Yes" : "No",
      };
    });
  }

  const rosterCount = employeeRows.length;

  return (
    <FtsPeopleDirectory
      employeeRows={employeeRows}
      adminRows={adminRows}
      isSuper={isSuper === true}
      adminPortalOnlyCount={activeAdminPortalOnly}
      stats={{
        totalFtsPeople,
        rosterCount,
        activeAdminPortalOnly,
      }}
    />
  );
}
