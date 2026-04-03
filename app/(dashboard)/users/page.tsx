import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";
import { UsersList, type UserListRow } from "@/components/users/UsersList";

type ProfileWithRoles = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  is_super_user: boolean | null;
  created_at: string | null;
  user_roles: { roles: { name: string } | null }[] | null;
};

function buildRolesDisplay(u: ProfileWithRoles): string {
  const names = (u.user_roles ?? [])
    .map((ur) => ur.roles?.name)
    .filter((n): n is string => Boolean(n));
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
      .select(
        `
        id,
        email,
        full_name,
        status,
        is_super_user,
        created_at,
        user_roles ( roles ( name ) )
      `
      )
      .order("email"),
    supabase.from("employees").select("email"),
  ]);

  const profiles = (usersRes.data ?? []) as unknown as ProfileWithRoles[];
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
    roles_display: buildRolesDisplay(u),
  }));

  return <UsersList rows={rows} />;
}
