import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeRegionProjectAssignmentsClient } from "@/components/employees/EmployeeRegionProjectAssignmentsClient";
import { formatEmployeeRoleDisplay } from "@/lib/employees/employee-role-options";

export default async function EmployeeRegionProjectAssignmentsPage() {
  const { profile } = await getCurrentUserProfile();
  if (!profile?.is_super_user) redirect("/employees");

  const supabase = await getDataClient();
  const { data: employeesRaw } = await supabase.from("employees").select("id, full_name, region_id, project_id").order("full_name");
  const empIds = (employeesRaw ?? []).map((e) => e.id);
  const { data: roleRows } = await supabase
    .from("employee_roles")
    .select("employee_id, role, role_custom")
    .in("employee_id", empIds);
  const roleByEmp = new Map<string, string>();
  for (const r of roleRows ?? []) {
    if (!roleByEmp.has(r.employee_id)) {
      roleByEmp.set(r.employee_id, formatEmployeeRoleDisplay(r.role, r.role_custom));
    }
  }
  const employees = (employeesRaw ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name ?? "",
    region_id: e.region_id,
    project_id: e.project_id,
    role: roleByEmp.get(e.id) ?? "",
  }));

  const { data: regions } = await supabase.from("regions").select("id, name").order("name");
  const { data: projects } = await supabase.from("projects").select("id, name, region_id").order("name");

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/employees" className="transition hover:text-zinc-900">
          Employees
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-zinc-800">Region &amp; project assignments</span>
      </nav>
      <header className="border-b border-zinc-200/80 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Super User</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">Region &amp; project assignments</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Assign primary region (where the person works) and formal project per employee. Projects are not limited by region — e.g. the same rollout project can apply in South, East, or West. Use filters and search; rows that need attention are sorted first. For Project Managers, extra regions beyond the primary are set on the employee profile under{" "}
          <span className="font-medium text-zinc-800">PM scope</span>.
        </p>
      </header>
      <EmployeeRegionProjectAssignmentsClient employees={employees} regions={regions ?? []} projects={projects ?? []} />
    </div>
  );
}
