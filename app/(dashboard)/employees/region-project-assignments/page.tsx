import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeRegionProjectAssignmentsClient } from "@/components/employees/EmployeeRegionProjectAssignmentsClient";

export default async function EmployeeRegionProjectAssignmentsPage() {
  const { profile } = await getCurrentUserProfile();
  if (!profile?.is_super_user) redirect("/employees");

  const supabase = await getDataClient();
  const { data: employeesRaw } = await supabase.from("employees").select("id, full_name, region_id, project_id").order("full_name");
  const empIds = (employeesRaw ?? []).map((e) => e.id);
  const { data: roleRows } = await supabase.from("employee_roles").select("employee_id, role").in("employee_id", empIds);
  const roleByEmp = new Map<string, string>();
  for (const r of roleRows ?? []) {
    if (!roleByEmp.has(r.employee_id)) roleByEmp.set(r.employee_id, r.role);
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
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/employees" className="hover:text-zinc-900">
          Employees
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Region &amp; project assignments</span>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Employee region &amp; project assignments</h1>
        <p className="mt-1 text-sm text-zinc-500">Super User only. Assign after the employee profile is created.</p>
      </div>
      <EmployeeRegionProjectAssignmentsClient employees={employees} regions={regions ?? []} projects={projects ?? []} />
    </div>
  );
}
