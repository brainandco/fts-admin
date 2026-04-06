import { getDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { can } from "@/lib/rbac/permissions";
import { TeamForm } from "@/components/teams/TeamForm";

export default async function NewTeamPage() {
  if (!(await can("teams.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();

  const { data: employees } = await supabase.from("employees").select("id, full_name, region_id").eq("status", "ACTIVE");
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
    region_id: e.region_id ?? null,
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
        Set each member&apos;s region (and project where required) on{" "}
        <Link href="/employees/region-project-assignments" className="font-medium text-indigo-600 hover:text-indigo-800">
          Employee region &amp; project assignments
        </Link>
        . The team inherits region and project from the DT; Driver/Rigger must match the DT&apos;s region.
      </p>
      <TeamForm existing={null} employees={employeesWithRoles} unavailableEmployeeIds={unavailableEmployeeIds} />
    </div>
  );
}
