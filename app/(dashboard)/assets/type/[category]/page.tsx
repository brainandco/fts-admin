import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/ui/DataTable";

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

export default async function AssetTypePage({ params }: { params: Promise<{ category: string }> }) {
  if (!(await can("assets.manage"))) redirect("/dashboard");

  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const showImei = /mobile/i.test(category);
  const supabase = await getDataClient();

  const { data: assets } = await supabase
    .from("assets")
    .select("id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id, software_connectivity")
    .eq("category", category)
    .order("name");

  const employeeIds = [...new Set((assets ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: employees } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
    : { data: [] };
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  const rows = (assets ?? []).map((a) => ({
    ...a,
    assigned_name: a.assigned_to_employee_id ? employeeMap.get(a.assigned_to_employee_id) ?? "—" : "—",
  }));
  const availableRows = rows.filter((r) => r.status === "Available" && !r.assigned_to_employee_id);
  const pendingRows = rows.filter((r) => r.status === "Pending_Return");
  const maintenanceRows = rows.filter((r) => r.status === "Under_Maintenance");
  const damagedRows = rows.filter((r) => r.status === "Damaged");
  const activeRows = rows.filter((r) => r.status !== "Under_Maintenance" && r.status !== "Damaged");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <nav className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/assets" className="hover:text-zinc-900">Assets</Link>
          <span aria-hidden>/</span>
          <span className="text-zinc-900">{category}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900">{category}</h1>
        {/* <p className="mt-1 text-sm text-zinc-600">
          {rows.length} asset(s) in this type.
        </p> */}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={rows.length} />
        <StatCard label="Available" value={availableRows.length} tone="emerald" />
        <StatCard label="Pending return" value={pendingRows.length} tone="violet" />
        <StatCard label="Under maintenance" value={maintenanceRows.length} tone="orange" />
        <StatCard label="Damaged" value={damagedRows.length} tone="red" />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Active / pool assets</h2>
        {/* <p className="mb-3 text-sm text-zinc-500">Available, assigned, and pending-return assets for this type.</p> */}
        {activeRows.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">No active/pool assets in this type.</p>
        ) : (
          <DataTable
            keyField="id"
            data={activeRows}
            hrefPrefix="/assets/"
            filterKeys={["status"]}
            searchPlaceholder="Search by name, serial…"
            columns={[
              { key: "name", label: "Name" },
              { key: "model", label: "Model" },
              { key: "serial", label: "Serial" },
              ...(showImei ? [{ key: "imei_1", label: "IMEI 1" }, { key: "imei_2", label: "IMEI 2" }] : []),
              { key: "software_connectivity", label: "Software" },
              { key: "assigned_name", label: "Assigned to" },
              { key: "status", label: "Status" },
            ]}
          />
        )}
      </section>

      <section className="rounded-xl border border-orange-200 bg-orange-50/30 p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Under maintenance</h2>
        {maintenanceRows.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No under-maintenance assets in this type.</p>
        ) : (
          <DataTable
            keyField="id"
            data={maintenanceRows}
            hrefPrefix="/assets/"
            searchPlaceholder="Search by name, serial…"
            columns={[
              { key: "serial", label: "Serial" },
              { key: "model", label: "Model" },
              ...(showImei ? [{ key: "imei_1", label: "IMEI 1" }, { key: "imei_2", label: "IMEI 2" }] : []),
              { key: "name", label: "Name" },
              { key: "software_connectivity", label: "Software" },
              { key: "status", label: "Status" },
            ]}
          />
        )}
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50/30 p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Damaged</h2>
        {damagedRows.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No damaged assets in this type.</p>
        ) : (
          <DataTable
            keyField="id"
            data={damagedRows}
            hrefPrefix="/assets/"
            searchPlaceholder="Search by name, serial…"
            columns={[
              { key: "serial", label: "Serial" },
              { key: "model", label: "Model" },
              ...(showImei ? [{ key: "imei_1", label: "IMEI 1" }, { key: "imei_2", label: "IMEI 2" }] : []),
              { key: "name", label: "Name" },
              { key: "software_connectivity", label: "Software" },
              { key: "status", label: "Status" },
            ]}
          />
        )}
      </section>

      {/* <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">All assets in this type</h2>
        <p className="mb-3 text-sm text-zinc-500">Complete list including maintenance and damaged.</p>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">No assets found for this type.</p>
        ) : (
          <DataTable
            keyField="id"
            data={rows}
            hrefPrefix="/assets/"
            filterKeys={["status"]}
            searchPlaceholder="Search by name, serial…"
            columns={[
              { key: "serial", label: "Serial" },
              { key: "model", label: "Model" },
              { key: "imei_1", label: "IMEI 1" },
              { key: "imei_2", label: "IMEI 2" },
              { key: "name", label: "Name" },
              { key: "software_connectivity", label: "Software" },
              { key: "status", label: "Status" },
              { key: "assigned_name", label: "Assigned to" },
            ]}
          />
        )}
      </section> */}
    </div>
  );
}
