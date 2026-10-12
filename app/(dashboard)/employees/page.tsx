import { getDataClient } from "@/lib/supabase/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { PERMISSION_EMPLOYEE_MANAGE } from "@/lib/rbac/permission-codes";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeImport } from "@/components/employees/EmployeeImport";
import { ProvisionDriverLoginsButton } from "@/components/employees/ProvisionDriverLoginsButton";
import { formatEmployeeRoleDisplay } from "@/lib/employees/employee-role-options";
import { EmployeesDirectoryTable } from "@/components/employees/EmployeesDirectoryTable";
import { ServerPagination, ServerSearchForm } from "@/components/ui/ServerPagination";
import { clampPage, parseListPagination, parseSearchQuery } from "@/lib/ui/list-pagination";

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

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [canViewUsers, canManageEmployees, canCreateUsers, { profile }, params] = await Promise.all([
    can("users.view"),
    can(PERMISSION_EMPLOYEE_MANAGE),
    can("users.create"),
    getCurrentUserProfile(),
    searchParams,
  ]);
  const canViewDirectory = canViewUsers || canManageEmployees;
  if (!canViewDirectory) redirect("/dashboard");

  const canCreateOrImport = canCreateUsers || canManageEmployees;
  const canDeleteEmployee = profile?.is_super_user === true || canManageEmployees;
  const qRaw = parseSearchQuery(params);
  const q = qRaw.replace(/[%_,]/g, " ").trim();
  const pagination = parseListPagination(params);

  const supabase = await getDataClient();

  const searchOr = q
    ? `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,iqama_number.ilike.%${q}%,passport_number.ilike.%${q}%`
    : null;

  const countFilteredQuery = (() => {
    let qy = supabase.from("employees").select("id", { count: "exact", head: true });
    if (searchOr) qy = qy.or(searchOr);
    return qy;
  })();

  const [
    { count: totalEmployees },
    { count: activeEmployees },
    { count: withRolesCount },
    { count: withVehiclesCount },
    { count: filteredCount },
  ] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("employee_roles").select("employee_id", { count: "exact", head: true }),
    supabase.from("vehicle_assignments").select("employee_id", { count: "exact", head: true }),
    countFilteredQuery,
  ]);

  const totalFiltered = filteredCount ?? 0;
  const page = clampPage(pagination.page, totalFiltered, pagination.pageSize);
  const from = (page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  let pageQuery = supabase
    .from("employees")
    .select(
      "id, full_name, passport_number, country, email, phone, iqama_number, region_id, project_id, project_name_other, onboarding_date, status, created_at"
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (searchOr) pageQuery = pageQuery.or(searchOr);
  const { data: employees } = await pageQuery;

  const empIds = (employees ?? []).map((e) => e.id);
  const regionIds = [...new Set((employees ?? []).map((e) => e.region_id).filter(Boolean) as string[])];
  const projectIds = [...new Set((employees ?? []).map((e) => e.project_id).filter(Boolean) as string[])];

  const [{ data: roleRows }, { data: assignments }, { data: regions }, { data: projects }] = await Promise.all([
    empIds.length
      ? supabase.from("employee_roles").select("employee_id, role, role_custom").in("employee_id", empIds)
      : Promise.resolve({ data: [] as { employee_id: string; role: string; role_custom: string | null }[] }),
    empIds.length
      ? supabase.from("vehicle_assignments").select("employee_id").in("employee_id", empIds)
      : Promise.resolve({ data: [] as { employee_id: string }[] }),
    regionIds.length
      ? supabase.from("regions").select("id, name").in("id", regionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const rolesByEmpId = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByEmpId.get(r.employee_id) ?? [];
    arr.push(formatEmployeeRoleDisplay(r.role, r.role_custom));
    rolesByEmpId.set(r.employee_id, arr);
  }

  const assigneeCount = new Map<string, number>();
  for (const a of assignments ?? []) {
    const id = a.employee_id;
    assigneeCount.set(id, (assigneeCount.get(id) ?? 0) + 1);
  }

  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const rows = (employees ?? []).map((e) => ({
    ...e,
    roles_display: (rolesByEmpId.get(e.id) ?? []).join(", ") || "—",
    region_name: e.region_id ? regionMap.get(e.region_id) ?? "" : "",
    project_name: e.project_id ? (projectMap.get(e.project_id) ?? "") : (e.project_name_other ?? ""),
    assigned_vehicles_count: assigneeCount.get(e.id) ?? 0,
    assigned_vehicles_display: (() => {
      const n = assigneeCount.get(e.id) ?? 0;
      return n === 0 ? "—" : String(n);
    })(),
  }));

  const queryPreserve = {
    ...(q ? { q } : {}),
    ...(pagination.pageSize !== 25 ? { pageSize: String(pagination.pageSize) } : {}),
  };

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
            {profile?.is_super_user ? <ProvisionDriverLoginsButton /> : null}
            {canCreateOrImport ? (
              <>
                <EmployeeImport />
                <Link
                  href="/employees/new"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                >
                  Add employee
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total employees" value={totalEmployees ?? 0} />
          <StatCard label="Active" value={activeEmployees ?? 0} tone="emerald" />
          <StatCard label="With roles" value={withRolesCount ?? 0} tone="violet" />
          <StatCard label="With vehicles" value={withVehiclesCount ?? 0} tone="amber" />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-zinc-900">Employee directory</h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {totalFiltered} match{totalFiltered === 1 ? "" : "es"}
            {q ? ` for “${q}”` : ""}
          </span>
        </div>
        <div className="mb-4">
          <ServerSearchForm
            pathname="/employees"
            q={q}
            placeholder="Search name, email, phone, Iqama…"
            preserve={{ pageSize: String(pagination.pageSize) }}
          />
        </div>
        <EmployeesDirectoryTable data={rows} canDelete={canDeleteEmployee} serverPaged />
        <ServerPagination
          pathname="/employees"
          page={page}
          pageSize={pagination.pageSize}
          total={totalFiltered}
          query={queryPreserve}
        />
      </div>
    </div>
  );
}
