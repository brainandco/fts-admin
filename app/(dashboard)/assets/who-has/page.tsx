import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminWhoHasAssetsClient, type AdminEmployeeWithAssets, type AssetLine } from "@/components/assets/AdminWhoHasAssetsClient";
import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";

export default async function AdminWhoHasAssetsPage() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }

  const supabase = await getDataClient();

  const { data: assignedAssets } = await supabase
    .from("assets")
    .select("id, name, model, serial, category, status, assigned_to_employee_id")
    .not("assigned_to_employee_id", "is", null)
    .in("status", ["Assigned", "Under_Maintenance", "Damaged", "With_QC"])
    .order("name");

  const empIdsFromAssets = [
    ...new Set((assignedAssets ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean) as string[]),
  ];

  const { data: emps } = empIdsFromAssets.length
    ? await supabase
        .from("employees")
        .select("id, full_name, email, region_id, status")
        .in("id", empIdsFromAssets)
        .eq("status", "ACTIVE")
        .order("full_name")
    : { data: [] };

  const activeEmpIds = new Set((emps ?? []).map((e) => e.id));

  const assetsByEmp = new Map<string, AssetLine[]>();
  for (const a of assignedAssets ?? []) {
    const eid = a.assigned_to_employee_id;
    if (!eid || !activeEmpIds.has(eid)) continue;
    const list = assetsByEmp.get(eid) ?? [];
    list.push({
      id: a.id,
      name: a.name,
      model: a.model,
      serial: a.serial,
      category: a.category,
      status: a.status,
    });
    assetsByEmp.set(eid, list);
  }

  const regionIds = [...new Set((emps ?? []).map((e) => e.region_id).filter(Boolean) as string[])];
  const { data: regions } = regionIds.length
    ? await supabase.from("regions").select("id, name, code").in("id", regionIds).order("name")
    : { data: [] };

  const regionMap = new Map((regions ?? []).map((r) => [r.id, `${r.name}${r.code ? ` · ${r.code}` : ""}`]));

  const empIds = (emps ?? []).map((e) => e.id);
  const { data: allRoles } = empIds.length
    ? await supabase.from("employee_roles").select("employee_id, role").in("employee_id", empIds)
    : { data: [] };

  const rolesByEmp = new Map<string, string[]>();
  for (const r of allRoles ?? []) {
    const arr = rolesByEmp.get(r.employee_id) ?? [];
    arr.push(r.role);
    rolesByEmp.set(r.employee_id, arr);
  }

  const employees: AdminEmployeeWithAssets[] = (emps ?? [])
    .filter((e) => (assetsByEmp.get(e.id)?.length ?? 0) > 0)
    .map((e) => ({
      id: e.id,
      full_name: e.full_name ?? "—",
      email: e.email,
      roles: rolesByEmp.get(e.id) ?? [],
      assets: assetsByEmp.get(e.id) ?? [],
      regionId: e.region_id,
      regionLabel: e.region_id ? (regionMap.get(e.region_id) ?? "—") : "No region",
    }));

  const { count: activeEmployeeCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE");

  const withoutCount = Math.max(0, (activeEmployeeCount ?? 0) - employees.length);

  const { data: allRegionsForFilter } = await supabase.from("regions").select("id, name, code").order("name");
  const regionOptions = (allRegionsForFilter ?? []).map((r) => ({
    id: r.id,
    label: `${r.name}${r.code ? ` · ${r.code}` : ""}`,
  }));

  return (
    <div className="space-y-8 pb-10">
      <div>
        <Link href="/assets" className="text-sm font-medium text-zinc-500 transition hover:text-indigo-600">
          ← Assets
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600/90">Admin · Asset management</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">Who has assets</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
              Active employees with at least one tool assigned (including under maintenance, damaged, or with QC). Filter
              by region, search by person or asset details, and open the employee record when you need to make changes.
            </p>
          </div>
        </div>
      </div>

      <AdminWhoHasAssetsClient employees={employees} withoutCount={withoutCount} regionOptions={regionOptions} />
    </div>
  );
}
