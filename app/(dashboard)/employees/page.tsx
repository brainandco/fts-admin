import { getDataClient } from "@/lib/supabase/server";
import { can, getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeImport } from "@/components/employees/EmployeeImport";
import { EmployeesDirectoryTable } from "@/components/employees/EmployeesDirectoryTable";

function StatCard({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number;
  tone?: "zinc" | "emerald" | "amber" | "violet";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : tone === "violet"
          ? "bg-violet-50 border-violet-200 text-violet-800"
          : "bg-zinc-50 border-zinc-200 text-zinc-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function EmployeesPage() {
  if (!(await can("users.view"))) redirect("/dashboard");

  const { isSuper } = await getCurrentUserRolesAndPermissions();
  const supabase = await getDataClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, passport_number, country, email, phone, iqama_number, region_id, project_id, project_name_other, onboarding_date, status, created_at")
    .order("created_at", { ascending: false });

  const empIds = (employees ?? []).map((e) => e.id);
  const { data: roleRows } = await supabase.from("employee_roles").select("employee_id, role").in("employee_id", empIds);
  const rolesByEmpId = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByEmpId.get(r.employee_id) ?? [];
    arr.push(r.role);
    rolesByEmpId.set(r.employee_id, arr);
  }

  const { data: assignments } = await supabase.from("vehicle_assignments").select("employee_id");
  const assigneeCount = new Map<string, number>();
  for (const a of assignments ?? []) {
    const id = a.employee_id;
    assigneeCount.set(id, (assigneeCount.get(id) ?? 0) + 1);
  }

  const regionIds = [...new Set((employees ?? []).map((e) => e.region_id).filter(Boolean) as string[])];
  const projectIds = [...new Set((employees ?? []).map((e) => e.project_id).filter(Boolean) as string[])];
  const { data: regions } = await supabase.from("regions").select("id, name").in("id", regionIds);
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const rows = (employees ?? []).map((e) => ({
    ...e,
    roles_display: (rolesByEmpId.get(e.id) ?? []).join(", ") || "—",
    region_name: e.region_id ? regionMap.get(e.region_id) ?? "" : "",
    project_name: e.project_id ? (projectMap.get(e.project_id) ?? "") : (e.project_name_other ?? ""),
    assigned_vehicles_count: assigneeCount.get(e.id) ?? 0,
    assigned_vehicles_display: (() => { const n = assigneeCount.get(e.id) ?? 0; return n === 0 ? "—" : String(n); })(),
  }));
  const totalEmployees = rows.length;
  const activeEmployees = rows.filter((r) => r.status === "ACTIVE").length;
  const withRoles = rows.filter((r) => r.roles_display !== "—").length;
  const withVehicles = rows.filter((r) => r.assigned_vehicles_count > 0).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-50 p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Employees</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage employee records, role visibility, and assignment readiness from one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EmployeeImport />
            <Link href="/employees/new" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
              Add employee
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total employees" value={totalEmployees} />
          <StatCard label="Active" value={activeEmployees} tone="emerald" />
          <StatCard label="With roles" value={withRoles} tone="violet" />
          <StatCard label="With vehicles" value={withVehicles} tone="amber" />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-zinc-900">Employee directory</h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {totalEmployees} records
          </span>
        </div>
        <EmployeesDirectoryTable data={rows} canDelete={isSuper === true} />
      </div>
    </div>
  );
}
