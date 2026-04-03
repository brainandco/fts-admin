import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";
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

  const users = usersRes.data ?? [];
  const employeeEmails = new Set((employeesRes.data ?? []).map((e) => (e.email ?? "").toLowerCase().trim()).filter(Boolean));
  const adminOnlyUsers = users.filter((u) => !employeeEmails.has((u.email ?? "").toLowerCase().trim()));
  const rows = adminOnlyUsers;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Users</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Admin portal users only. Employees (workforce) are managed under Employees and do not appear here.</p>
        </div>
        <Link href="/users/invite" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">
          Add user
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <DataTable
        keyField="id"
        data={rows}
        hrefPrefix="/users/"
        filterKeys={["status"]}
        searchPlaceholder="Search users…"
        columns={[
          { key: "email", label: "Email" },
          { key: "full_name", label: "Name", format: "text" },
          { key: "status", label: "Status" },
          { key: "is_super_user", label: "Super", format: "boolean" },
        ]}
        />
      </div>
    </div>
  );
}
