import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { buildGlobalAssetAssignees } from "@/lib/admin-assignment/team-region-lists";
import { AdminBulkAssignAssetsClient } from "@/components/assets/AdminBulkAssignAssetsClient";
import { AdminBulkAssignEhsToolsClient } from "@/components/ehs/AdminBulkAssignEhsToolsClient";
import { FleetEhsSectionTabs } from "@/components/ui/FleetEhsSectionTabs";
import { parseFleetEhsTab } from "@/lib/assets/fleet-ehs-tabs";
import { DRIVER_RIGGER_ROLE } from "@/lib/employees/driver-iqama";

export default async function AdminAssignAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }

  const sp = (await Promise.resolve(searchParams ?? {})) as { tab?: string };
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

  const [{ data: catalogRows }, { data: ehsCatalogRows }, { data: roleRows }] = await Promise.all([
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
    supabase.from("employee_roles").select("employee_id, role").in("role", [DRIVER_RIGGER_ROLE, "Self DT"]),
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

  const driverIds = [...new Set((roleRows ?? []).map((r) => r.employee_id as string))];
  const { data: driverEmps } = driverIds.length
    ? await supabase
        .from("employees")
        .select("id, full_name, email, region_id, status")
        .in("id", driverIds)
        .eq("status", "ACTIVE")
        .order("full_name")
    : { data: [] };

  const drivers = (driverEmps ?? []).map((e) => ({
    id: e.id as string,
    full_name: ((e.full_name as string | null) ?? (e.email as string | null) ?? "Driver/Rigger").trim(),
    region_id: (e.region_id as string | null) ?? null,
  }));

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
            ? "Assign EHS tools directly to a Driver/Rigger. Receipt and confirmation sit with that employee."
            : "Assign fleet assets to an eligible employee (QC excluded). Search shows pool vs assigned status."}
        </p>
        <span className="mt-4 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
          {tab === "ehs"
            ? `Driver/Riggers: ${drivers.length} · Available EHS: ${ehsAssets.length}`
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
          <AdminBulkAssignEhsToolsClient assets={ehsAssets} searchCatalog={ehsSearchCatalog} drivers={drivers} />
        )}
      </div>
    </div>
  );
}
