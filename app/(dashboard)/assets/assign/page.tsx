import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { buildGlobalAssetAssignees } from "@/lib/admin-assignment/team-region-lists";
import { AdminBulkAssignAssetsClient } from "@/components/assets/AdminBulkAssignAssetsClient";

export default async function AdminAssignAssetsPage() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }

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

  const { data: catalogRows } = await supabase
    .from("assets")
    .select("id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id")
    .eq("is_ehs_tool", false)
    .order("name");

  const empIds = [...new Set((catalogRows ?? []).map((r) => r.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: emps } = empIds.length
    ? await supabase.from("employees").select("id, full_name, email").in("id", empIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const nameById = new Map(
    (emps ?? []).map((e) => [e.id, (e.full_name ?? e.email ?? "Employee").trim() || "Employee"])
  );

  const searchCatalog: CatalogRow[] = (catalogRows ?? []).map((r) => ({
    ...r,
    assigneeName: r.assigned_to_employee_id ? (nameById.get(r.assigned_to_employee_id) ?? "Employee") : null,
  }));
  const assets = searchCatalog.filter((a) => a.status === "Available" && !a.assigned_to_employee_id);

  const assigneeRows = await buildGlobalAssetAssignees(supabase);
  const assignees = assigneeRows.map((e) => ({ id: e.id, label: e.display_label }));

  return (
    <div className="space-y-5">
      <nav className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/assets" className="hover:text-zinc-900">
          Assets
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Assign assets</span>
      </nav>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Assign assets</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Assign available assets to an eligible employee (QC excluded). Search shows whether a tool is in the pool or
          already assigned to someone.
        </p>
        <span className="mt-4 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
          Eligible employees: {assignees.length}
        </span>
      </div>
      <AdminBulkAssignAssetsClient assets={assets} searchCatalog={searchCatalog} assignees={assignees} />
    </div>
  );
}
