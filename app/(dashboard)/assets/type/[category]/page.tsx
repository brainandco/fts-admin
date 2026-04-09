import Link from "next/link";
import { redirect } from "next/navigation";
import { can, PERMISSION_BULK_DELETE } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { AssetCategoryTables, type AssetCategoryRow } from "@/components/assets/AssetCategoryTables";
import { AssetPoolQuantityCard, type AssetPoolQuantityBreakdown } from "@/components/assets/AssetPoolQuantityCard";
import { categoryGroupsByCompany, companyFromAssetRow } from "@/lib/assets/asset-id-scheme";
import { companyGroupingKey, companySectionAnchorId, rawCompanyFromAsset } from "@/lib/assets/company-display";

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

type RowForCompanyStats = {
  status: string;
  assigned_to_employee_id: string | null;
  company_label: string;
  company_group_key: string;
};

function countByCompany(rows: RowForCompanyStats[]): Map<string, AssetPoolQuantityBreakdown & { display: string }> {
  const m = new Map<string, AssetPoolQuantityBreakdown & { display: string }>();
  for (const r of rows) {
    const key = r.company_group_key;
    let cur = m.get(key);
    if (!cur) {
      cur = {
        display: r.company_label,
        total: 0,
        unassigned: 0,
        assigned: 0,
        pending_return: 0,
        under_maintenance: 0,
        damaged: 0,
      };
      m.set(key, cur);
    }
    cur.total += 1;
    if (r.status === "Pending_Return") cur.pending_return += 1;
    else if (r.status === "Under_Maintenance") cur.under_maintenance += 1;
    else if (r.status === "Damaged") cur.damaged += 1;
    else if (r.status === "Available" && !r.assigned_to_employee_id) cur.unassigned += 1;
    else cur.assigned += 1;
  }
  return new Map(
    [...m.entries()].sort((a, b) => a[1].display.localeCompare(b[1].display, undefined, { sensitivity: "base" }))
  );
}

export default async function AssetTypePage({ params }: { params: Promise<{ category: string }> }) {
  if (!(await can("assets.manage"))) redirect("/dashboard");
  const canBulkDelete = await can(PERMISSION_BULK_DELETE);

  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const showImei = /mobile/i.test(category);
  const supabase = await getDataClient();

  const { data: assets } = await supabase
    .from("assets")
    .select("id, asset_id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id, software_connectivity, specs")
    .eq("category", category)
    .order("name");

  const groupByCompany = categoryGroupsByCompany(category);

  const employeeIds = [...new Set((assets ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: employees } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
    : { data: [] };
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  const rows = (assets ?? []).map((a) => {
    const rawCompany = rawCompanyFromAsset(a.specs, a.name);
    return {
      ...a,
      assigned_name: a.assigned_to_employee_id ? employeeMap.get(a.assigned_to_employee_id) ?? "—" : "—",
      company_label: companyFromAssetRow(a.specs, a.name),
      company_group_key: companyGroupingKey(rawCompany || "—"),
    };
  });
  const availableRows = rows.filter((r) => r.status === "Available" && !r.assigned_to_employee_id);
  const pendingRows = rows.filter((r) => r.status === "Pending_Return");
  const maintenanceRows = rows.filter((r) => r.status === "Under_Maintenance");
  const damagedRows = rows.filter((r) => r.status === "Damaged");
  const activeRows = rows.filter((r) => r.status !== "Under_Maintenance" && r.status !== "Damaged");

  const byCompany = groupByCompany
    ? countByCompany(
        rows.map((r) => ({
          status: r.status,
          assigned_to_employee_id: r.assigned_to_employee_id,
          company_label: r.company_label,
          company_group_key: r.company_group_key,
        }))
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <nav className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/assets" className="hover:text-zinc-900">Assets</Link>
          <span aria-hidden>/</span>
          <span className="text-zinc-900">{category}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900">{category}</h1>
        {groupByCompany ? (
          <p className="mt-2 text-sm text-zinc-600">Lists are grouped by <span className="font-medium text-zinc-800">company / brand</span> (from each asset&apos;s details).</p>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={rows.length} />
        <StatCard label="Available" value={availableRows.length} tone="emerald" />
        <StatCard label="Pending return" value={pendingRows.length} tone="violet" />
        <StatCard label="Under maintenance" value={maintenanceRows.length} tone="orange" />
        <StatCard label="Damaged" value={damagedRows.length} tone="red" />
      </section>

      {byCompany && byCompany.size > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Quantity by company</h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {byCompany.size} companies
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...byCompany.entries()].map(([groupKey, stats]) => {
              const { display, ...counts } = stats;
              return (
                <AssetPoolQuantityCard
                  key={groupKey}
                  title={display}
                  counts={counts}
                  footerHref={`#${companySectionAnchorId(groupKey)}`}
                  footerLabel={`View ${display} list →`}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <AssetCategoryTables
        showImei={showImei}
        canBulkDelete={canBulkDelete}
        activeRows={activeRows as AssetCategoryRow[]}
        maintenanceRows={maintenanceRows as AssetCategoryRow[]}
        damagedRows={damagedRows as AssetCategoryRow[]}
        groupByCompany={groupByCompany}
      />
    </div>
  );
}
