import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getEhsToolType } from "@/lib/assets/ehs-tool-catalog";

type CountRow = {
  ehs_tool_type: string | null;
  ehs_wear_role: string | null;
  total: number;
  unassigned: number;
  assigned: number;
};

function countByType(
  assets: {
    ehs_tool_type: string | null;
    ehs_wear_role: string | null;
    status: string;
    assigned_to_employee_id: string | null;
  }[]
): CountRow[] {
  const map = new Map<string, CountRow>();
  for (const a of assets) {
    const key = `${a.ehs_tool_type ?? "?"}:${a.ehs_wear_role ?? "?"}`;
    const def = a.ehs_tool_type ? getEhsToolType(a.ehs_tool_type) : undefined;
    const label = def?.label ?? a.ehs_tool_type ?? "Other";
    const cur = map.get(key) ?? {
      ehs_tool_type: label,
      ehs_wear_role: a.ehs_wear_role,
      total: 0,
      unassigned: 0,
      assigned: 0,
    };
    cur.total += 1;
    if (a.status === "Available" && !a.assigned_to_employee_id) cur.unassigned += 1;
    else cur.assigned += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => String(a.ehs_tool_type).localeCompare(String(b.ehs_tool_type)));
}

export default async function EhsToolsPage() {
  if (!(await can("assets.manage"))) redirect("/dashboard");

  const supabase = await getDataClient();
  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, asset_id, name, category, condition, status, assigned_to_employee_id, ehs_wear_role, ehs_tool_type, en_code, ehs_for_employee_id, created_at"
    )
    .eq("is_ehs_tool", true)
    .order("asset_id");

  const rows = assets ?? [];
  const byType = countByType(rows);
  const total = rows.length;
  const available = rows.filter((r) => r.status === "Available" && !r.assigned_to_employee_id).length;
  const assigned = total - available;

  const empIds = [...new Set(rows.map((r) => r.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: employees } = empIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", empIds)
    : { data: [] };
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">EHS Tools</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Safety equipment (shoes, harness, PPE) — separate pool from regular assets. Unified EN codes per tool type.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/ehs-tools/assign"
              className="rounded border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-900 hover:bg-orange-50"
            >
              Assign EHS tools
            </Link>
            <Link href="/ehs-tools/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Add EHS tool
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-orange-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase text-orange-800/80">Total EHS tools</p>
            <p className="mt-1 text-2xl font-semibold text-orange-950">{total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-emerald-800/80">Available</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-950">{available}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-amber-800/80">Assigned</p>
            <p className="mt-1 text-2xl font-semibold text-amber-950">{assigned}</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">By tool type</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Tool</th>
                <th className="px-4 py-2">Wear</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Available</th>
                <th className="px-4 py-2">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {byType.map((row) => (
                <tr key={`${row.ehs_tool_type}-${row.ehs_wear_role}`} className="border-t border-zinc-100">
                  <td className="px-4 py-2">{row.ehs_tool_type}</td>
                  <td className="px-4 py-2">{row.ehs_wear_role === "driver_rigger" ? "Driver/Rigger" : "DT"}</td>
                  <td className="px-4 py-2">{row.total}</td>
                  <td className="px-4 py-2">{row.unassigned}</td>
                  <td className="px-4 py-2">{row.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">All EHS tools</h2>
          <Link href="/ehs-tools/who-has" className="text-sm text-indigo-700 hover:underline">
            Who has EHS tools (by team) →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Asset ID</th>
                <th className="px-4 py-2">Tool</th>
                <th className="px-4 py-2">Wear</th>
                <th className="px-4 py-2">EN Code</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Assigned to (DT)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link href={`/ehs-tools/${r.id}`} className="font-mono text-xs text-indigo-700 hover:underline">
                      {r.asset_id}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.ehs_wear_role === "driver_rigger" ? "Driver/Rigger" : "DT"}</td>
                  <td className="px-4 py-2 text-xs">{r.en_code}</td>
                  <td className="px-4 py-2">{r.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    {r.assigned_to_employee_id ? employeeMap.get(r.assigned_to_employee_id) ?? "—" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">No EHS tools yet. Add the first tool above.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
