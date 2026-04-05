import Link from "next/link";
import { redirect } from "next/navigation";
import { can, PERMISSION_BULK_DELETE } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { SimImport } from "@/components/sims/SimImport";
import { SimsInventoryTables, type SimInventoryRow } from "@/components/sims/SimsInventoryTables";

export default async function SimsPage() {
  if (!(await can("assets.manage"))) redirect("/dashboard");
  const canBulkDelete = await can(PERMISSION_BULK_DELETE);
  const supabase = await getDataClient();
  const { data: sims } = await supabase
    .from("sim_cards")
    .select("id, operator, service_type, sim_number, phone_number, status, assigned_to_employee_id, assigned_at")
    .order("created_at", { ascending: false });

  const employeeIds = [...new Set((sims ?? []).map((s) => s.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: employees } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
    : { data: [] };
  const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  const rows = (sims ?? []).map((s) => ({
    ...s,
    assigned_name: s.assigned_to_employee_id ? empMap.get(s.assigned_to_employee_id) ?? "—" : "—",
  }));
  const availableRows = rows.filter((r) => r.status === "Available");
  const assignedRows = rows.filter((r) => r.status === "Assigned");
  const inactiveRows = rows.filter((r) => r.status === "Inactive");

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">SIM cards</h1>
            <p className="mt-1 text-sm text-zinc-600">Track operators, service type, SIM numbers, and assignment by employee.</p>
          </div>
          <div className="flex gap-2">
            <SimImport />
            <Link href="/sims/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Add SIM
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"><p className="text-xs text-zinc-600">Total</p><p className="text-2xl font-semibold text-zinc-900">{rows.length}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-xs text-emerald-700">Available</p><p className="text-2xl font-semibold text-emerald-800">{availableRows.length}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-xs text-amber-700">Assigned</p><p className="text-2xl font-semibold text-amber-800">{assignedRows.length}</p></div>
          <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3"><p className="text-xs text-zinc-700">Inactive</p><p className="text-2xl font-semibold text-zinc-800">{inactiveRows.length}</p></div>
        </div>
      </div>

      <SimsInventoryTables
        canBulkDelete={canBulkDelete}
        availableRows={availableRows as SimInventoryRow[]}
        assignedRows={assignedRows as SimInventoryRow[]}
      />
    </div>
  );
}
