import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { AssetImport } from "@/components/assets/AssetImport";
import Link from "next/link";

type CountByType = {
  category: string;
  total: number;
  unassigned: number;
  assigned: number;
  pending_return: number;
  under_maintenance: number;
  damaged: number;
};

function countByType(assets: { category: string; status: string; assigned_to_employee_id: string | null }[]): CountByType[] {
  const map = new Map<string, { total: number; unassigned: number; assigned: number; pending_return: number; under_maintenance: number; damaged: number }>();
  for (const a of assets) {
    const cat = a.category || "Other";
    const cur = map.get(cat) ?? { total: 0, unassigned: 0, assigned: 0, pending_return: 0, under_maintenance: 0, damaged: 0 };
    cur.total += 1;
    if (a.status === "Pending_Return") cur.pending_return += 1;
    else if (a.status === "Under_Maintenance") cur.under_maintenance += 1;
    else if (a.status === "Damaged") cur.damaged += 1;
    else if (a.status === "Available" && !a.assigned_to_employee_id) cur.unassigned += 1;
    else cur.assigned += 1;
    map.set(cat, cur);
  }
  return [...map.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => a.category.localeCompare(b.category));
}

function StatCard({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number;
  tone?: "zinc" | "emerald" | "amber" | "violet" | "orange" | "red";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : tone === "violet"
          ? "bg-violet-50 border-violet-200 text-violet-800"
          : tone === "orange"
            ? "bg-orange-50 border-orange-200 text-orange-800"
            : tone === "red"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-zinc-50 border-zinc-200 text-zinc-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function AssetsPage() {
  if (!(await can("assets.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { data: assets } = await supabase
    .from("assets")
    .select("id, asset_id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id, software_connectivity, created_at")
    .order("name");

  const byType = countByType(assets ?? []);
  const employeeIds = [...new Set((assets ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: employees } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
    : { data: [] };
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  const rows = (assets ?? []).map((a) => ({
    ...a,
    assigned_name: a.assigned_to_employee_id ? employeeMap.get(a.assigned_to_employee_id) ?? "—" : "—",
  }));
  const unassignedRows = rows.filter((r) => r.status === "Available" && !r.assigned_to_employee_id);
  const pendingReturnRows = rows.filter((r) => r.status === "Pending_Return");
  const maintenanceRows = rows.filter((r) => r.status === "Under_Maintenance");
  const damagedRows = rows.filter((r) => r.status === "Damaged");
  const assignedRows = rows.filter(
    (r) =>
      !(r.status === "Available" && !r.assigned_to_employee_id) &&
      r.status !== "Pending_Return" &&
      r.status !== "Under_Maintenance" &&
      r.status !== "Damaged"
  );
  const totalAssets = rows.length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-50 p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Assets</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage the full asset pool, assignment lifecycle, and return outcomes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AssetImport />
            <Link href="/assets/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Add tool
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total assets" value={totalAssets} />
          <StatCard label="Available" value={unassignedRows.length} tone="emerald" />
          <StatCard label="Assigned" value={assignedRows.length} tone="amber" />
          <StatCard label="Pending return" value={pendingReturnRows.length} tone="violet" />
          <StatCard label="Under maintenance" value={maintenanceRows.length} tone="orange" />
          <StatCard label="Damaged" value={damagedRows.length} tone="red" />
        </div>
      </div>

      {byType.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Quantity by type</h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {byType.length} categories
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {byType.map(({ category, total, unassigned, assigned, pending_return, under_maintenance, damaged }) => (
              <div key={category} className="rounded-xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/assets/type/${encodeURIComponent(category)}`}
                    className="font-semibold text-zinc-900 underline-offset-2 hover:text-indigo-700 hover:underline"
                  >
                    {category}
                  </Link>
                  <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">{total}</span>
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-emerald-700">Available</span>
                      <span className="text-zinc-600">{unassigned}</span>
                    </div>
                    <div className="h-1.5 rounded bg-zinc-100">
                      <div className="h-1.5 rounded bg-emerald-500" style={{ width: `${total ? (unassigned / total) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-amber-700">Assigned</span>
                      <span className="text-zinc-600">{assigned}</span>
                    </div>
                    <div className="h-1.5 rounded bg-zinc-100">
                      <div className="h-1.5 rounded bg-amber-500" style={{ width: `${total ? (assigned / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pending_return > 0 ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Pending return: {pending_return}</span>
                  ) : null}
                  {under_maintenance > 0 ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Maintenance: {under_maintenance}</span>
                  ) : null}
                  {damaged > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Damaged: {damaged}</span>
                  ) : null}
                  {pending_return === 0 && under_maintenance === 0 && damaged === 0 ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">No return flags</span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Link
                    href={`/assets/type/${encodeURIComponent(category)}`}
                    className="inline-flex items-center rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    View {category} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(maintenanceRows.length > 0 || damagedRows.length > 0) ? (
        <p className="mt-3 text-sm text-zinc-500">
          Maintenance and damaged assets are listed on{" "}
          <Link href="/assets/returns" className="font-medium text-zinc-700 underline hover:text-zinc-900">
            Asset returns
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
