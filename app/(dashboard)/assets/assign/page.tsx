import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { buildGlobalAssetAssignees } from "@/lib/admin-assignment/team-region-lists";
import { AdminBulkAssignAssetsClient } from "@/components/assets/AdminBulkAssignAssetsClient";
import { AdminBulkAssignEhsToolsClient } from "@/components/ehs/AdminBulkAssignEhsToolsClient";
import { FleetEhsSectionTabs, parseFleetEhsTab } from "@/components/ui/FleetEhsSectionTabs";

export default async function AdminAssignAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const tab = parseFleetEhsTab(sp.tab);

  const supabase = await getDataClient();

  type AssetRow = {
    id: string;
    name: string | null;
    category: string | null;
    model: string | null;
    serial: string | null;
    imei_1: string | null;
    imei_2: string | null;
    status: string;
    assigned_to_employee_id?: string | null;
  };
  type CatalogRow = AssetRow & { assigneeName: string | null };

  const [{ data: catalogRows }, { data: ehsCatalogRows }, { data: teamsRaw }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id")
      .eq("is_ehs_tool", false)
      .order("name"),
    supabase
      .from("assets")
      .select("id, asset_id, name, category, status, assigned_to_employee_id, ehs_tool_type, en_code")
      .eq("is_ehs_tool", true)
      .order("asset_id"),
    supabase
      .from("teams")
      .select("id, name, region_id, dt_employee_id, driver_rigger_employee_id")
      .not("dt_employee_id", "is", null)
      .order("name"),
  ]);

  const empIds = [...new Set((catalogRows ?? []).map((r) => r.assigned_to_employee_id).filter(Boolean) as string[])];
  const ehsEmpIds = [...new Set((ehsCatalogRows ?? []).map((r) => r.assigned_to_employee_id).filter(Boolean) as string[])];
  const allEmpIds = [...new Set([...empIds, ...ehsEmpIds])];

  const { data: emps } = allEmpIds.length
    ? await supabase.from("employees").select("id, full_name, email, status").in("id", allEmpIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; status: string }[] };
  const nameById = new Map(
    (emps ?? []).map((e) => [e.id, (e.full_name ?? e.email ?? "Employee").trim() || "Employee"])
  );
  const empStatusMap = new Map((emps ?? []).map((e) => [e.id, e.status]));

  const searchCatalog: CatalogRow[] = (catalogRows ?? []).map((r) => ({
    ...r,
    assigneeName: r.assigned_to_employee_id ? (nameById.get(r.assigned_to_employee_id) ?? "Employee") : null,
  }));
  const assets = searchCatalog.filter((a) => a.status === "Available" && !a.assigned_to_employee_id);

  const ehsSearchCatalog = (ehsCatalogRows ?? []).map((r) => ({
    ...r,
    assigneeName: r.assigned_to_employee_id ? (nameById.get(r.assigned_to_employee_id) ?? "Employee") : null,
  }));
  const ehsAssets = ehsSearchCatalog.filter((a) => a.status === "Available" && !a.assigned_to_employee_id);

  const teamEmpIds = [
    ...new Set(
      (teamsRaw ?? []).flatMap((t) => [t.dt_employee_id, t.driver_rigger_employee_id].filter(Boolean) as string[])
    ),
  ];
  const missingTeamEmpIds = teamEmpIds.filter((id) => !empStatusMap.has(id));
  if (missingTeamEmpIds.length) {
    const { data: extraEmps } = await supabase
      .from("employees")
      .select("id, full_name, email, status")
      .in("id", missingTeamEmpIds);
    for (const e of extraEmps ?? []) {
      empStatusMap.set(e.id, e.status);
      nameById.set(e.id, (e.full_name ?? e.email ?? "—").trim() || "—");
    }
  }

  const dtTeams = (teamsRaw ?? [])
    .filter((t) => {
      const dtId = t.dt_employee_id as string;
      return empStatusMap.get(dtId) === "ACTIVE";
    })
    .map((t) => {
      const dtId = t.dt_employee_id as string;
      const driverId = t.driver_rigger_employee_id as string | null;
      return {
        teamId: t.id as string,
        teamName: (t.name as string)?.trim() || "Team",
        dt: { id: dtId, full_name: nameById.get(dtId) ?? "DT" },
        driver:
          driverId && empStatusMap.get(driverId) === "ACTIVE"
            ? { id: driverId, full_name: nameById.get(driverId) ?? "Driver/Rigger" }
            : null,
      };
    });

  const assigneeRows = await buildGlobalAssetAssignees(supabase);
  const assignees = assigneeRows.map((e) => ({ id: e.id, label: e.display_label }));

  return (
    <div className="space-y-5">
      <nav className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/assets" className="hover:text-zinc-900">
          Assets
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Assign</span>
      </nav>
      <div
        className={`rounded-2xl border p-5 sm:p-6 ${
          tab === "ehs"
            ? "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50"
            : "border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50"
        }`}
      >
        <h1 className="text-2xl font-semibold text-zinc-900">Assign assets & EHS tools</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {tab === "ehs"
            ? "Assign EHS tools to a team DT. Choose DT or Driver/Rigger wear context when assigning."
            : "Assign fleet assets to an eligible employee (QC excluded). Search shows pool vs assigned status."}
        </p>
        <span className="mt-4 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
          {tab === "ehs"
            ? `Teams with DT: ${dtTeams.length} · Available EHS: ${ehsAssets.length}`
            : `Eligible employees: ${assignees.length} · Available fleet: ${assets.length}`}
        </span>
      </div>

      <FleetEhsSectionTabs
        activeTab={tab}
        basePath="/assets/assign"
        fleetCount={assets.length}
        ehsCount={ehsAssets.length}
      />

      <div className="rounded-b-xl border border-t-0 border-zinc-200 bg-white p-4 sm:p-6">
        {tab === "fleet" ? (
          <AdminBulkAssignAssetsClient assets={assets} searchCatalog={searchCatalog} assignees={assignees} />
        ) : (
          <AdminBulkAssignEhsToolsClient assets={ehsAssets} searchCatalog={ehsSearchCatalog} dtTeams={dtTeams} />
        )}
      </div>
    </div>
  );
}
