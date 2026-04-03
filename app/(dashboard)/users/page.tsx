import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";
import { UsersList, type UserListRow } from "@/components/users/UsersList";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  is_super_user: boolean | null;
  created_at: string | null;
};

function roleNamesFromJoinedRow(row: { user_id: string; roles: unknown }): string[] {
  const r = row.roles;
  if (r == null) return [];
  if (Array.isArray(r)) {
    return r
      .map((x) => (x && typeof x === "object" && x !== null && "name" in x ? String((x as { name: string }).name) : ""))
      .filter(Boolean);
  }
  if (typeof r === "object" && "name" in r) return [String((r as { name: string }).name)];
  return [];
}

function buildRolesDisplay(userId: string, roleNamesByUser: Map<string, string[]>): string {
  const names = roleNamesByUser.get(userId) ?? [];
  if (names.length === 0) return "—";
  return [...new Set(names)].sort().join(", ");
}

export default async function UsersPage() {
  const { isSuper } = await getCurrentUserRolesAndPermissions();
  if (!isSuper) redirect("/dashboard");

  const supabase = await getDataClient();

  const [usersRes, employeesRes] = await Promise.all([
    supabase
      .from("users_profile")
      .select("id, email, full_name, status, is_super_user, created_at")
      .order("email"),
    supabase.from("employees").select("email"),
  ]);

  if (usersRes.error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-rose-900 shadow-sm">
        <h1 className="text-lg font-semibold">Could not load users</h1>
        <p className="mt-2 text-sm">{usersRes.error.message}</p>
        <p className="mt-3 text-sm text-rose-800/90">
          If you use the Super role (not only the super-user flag), apply migration{" "}
          <code className="rounded bg-rose-100 px-1 py-0.5 text-xs">00037_fts_is_super_user_includes_super_role.sql</code>{" "}
          so database access matches the admin UI. Ensure{" "}
          <code className="rounded bg-rose-100 px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> is set on the server
          for full list access.
        </p>
      </div>
    );
  }

  const profiles = (usersRes.data ?? []) as ProfileRow[];
  const ids = profiles.map((p) => p.id);

  const roleNamesByUser = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: urData, error: urError } = await supabase
      .from("user_roles")
      .select("user_id, roles(name)")
      .in("user_id", ids);
    if (!urError && urData) {
      for (const row of urData as { user_id: string; roles: unknown }[]) {
        for (const name of roleNamesFromJoinedRow(row)) {
          const list = roleNamesByUser.get(row.user_id) ?? [];
          list.push(name);
          roleNamesByUser.set(row.user_id, list);
        }
      }
    }
  }

  const employeeEmails = new Set(
    (employeesRes.data ?? []).map((e) => (e.email ?? "").toLowerCase().trim()).filter(Boolean)
  );

  /** Admin portal users only: exclude anyone whose email exists on the Employees table. */
  const adminOnly = profiles.filter((u) => !employeeEmails.has((u.email ?? "").toLowerCase().trim()));

  const rows: UserListRow[] = adminOnly.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    full_name: u.full_name,
    status: u.status ?? "PENDING_ACCESS",
    is_super_user: Boolean(u.is_super_user),
    created_at: u.created_at,
    roles_display: buildRolesDisplay(u.id, roleNamesByUser),
  }));

  return <UsersList rows={rows} />;
}
