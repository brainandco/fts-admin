import { getDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { TeamForm } from "@/components/teams/TeamForm";

export default async function NewTeamPage() {
  if (!(await can("teams.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user ?? false;

  const { data: employees } = await supabase.from("employees").select("id, full_name").eq("status", "ACTIVE");
  const { data: teams } = await supabase.from("teams").select("dt_employee_id, driver_rigger_employee_id");
  const empIds = (employees ?? []).map((e) => e.id);
  const { data: roleRows } = await supabase.from("employee_roles").select("employee_id, role, role_custom").in("employee_id", empIds);
  const rolesByEmpId = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByEmpId.get(r.employee_id) ?? [];
    arr.push(r.role);
    rolesByEmpId.set(r.employee_id, arr);
  }
  const employeesWithRoles = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    roles: rolesByEmpId.get(e.id) ?? [],
  }));
  const unavailableEmployeeIds = Array.from(
    new Set(
      (teams ?? []).flatMap((t) => [t.dt_employee_id, t.driver_rigger_employee_id].filter(Boolean) as string[])
    )
  );

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">New team</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Create the team first, then assign region and project
        {isSuper ? (
          <>
            {" "}
            on{" "}
            <Link href="/teams/region-project-assignments" className="font-medium text-indigo-600 hover:text-indigo-800">
              Region &amp; project assignments
            </Link>
          </>
        ) : (
          <> (Super User)</>
        )}
        .
      </p>
      <TeamForm existing={null} employees={employeesWithRoles} unavailableEmployeeIds={unavailableEmployeeIds} />
    </div>
  );
}
