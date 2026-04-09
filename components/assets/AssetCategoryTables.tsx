"use client";

import { DataTable } from "@/components/ui/DataTable";
import { companyGroupingKey, companySectionAnchorId } from "@/lib/assets/company-display";

export type AssetCategoryRow = Record<string, unknown> & { id: string };

const bulk = {
  apiPath: "/api/assets/bulk-delete",
  entityLabel: "assets",
  confirmTitle: "Delete selected assets",
} as const;

/** Group by case-insensitive company key; heading uses formatted label from first row in bucket. */
function groupRowsByCompanyLabel(rows: AssetCategoryRow[]): Map<string, { display: string; rows: AssetCategoryRow[] }> {
  const m = new Map<string, { display: string; rows: AssetCategoryRow[] }>();
  for (const r of rows) {
    const label = String(r.company_label ?? "—");
    const key = companyGroupingKey(label);
    const cur = m.get(key);
    if (!cur) {
      m.set(key, { display: label, rows: [r] });
    } else {
      cur.rows.push(r);
    }
  }
  return new Map(
    [...m.entries()].sort((a, b) => a[1].display.localeCompare(b[1].display, undefined, { sensitivity: "base" }))
  );
}

export function AssetCategoryTables({
  showImei,
  canBulkDelete,
  activeRows,
  maintenanceRows,
  damagedRows,
  groupByCompany = false,
}: {
  showImei: boolean;
  /** Super User grants "Execute bulk deletes" on a role; without it, row selection delete is hidden. */
  canBulkDelete: boolean;
  activeRows: AssetCategoryRow[];
  maintenanceRows: AssetCategoryRow[];
  damagedRows: AssetCategoryRow[];
  /** When true, rows must include `company_label`; tables are split under each company (Laptop / Mobile). */
  groupByCompany?: boolean;
}) {
  const imeiCols = showImei
    ? ([{ key: "imei_1", label: "IMEI 1" }, { key: "imei_2", label: "IMEI 2" }] as const)
    : [];

  const activeColumns = [
    { key: "asset_id", label: "Asset ID" },
    { key: "name", label: "Name" },
    { key: "model", label: "Model" },
    { key: "serial", label: "Serial" },
    ...imeiCols,
    { key: "software_connectivity", label: "Software" },
    { key: "assigned_name", label: "Assigned to" },
    { key: "status", label: "Status" },
  ];

  const maintenanceDamagedColumns = [
    { key: "asset_id", label: "Asset ID" },
    { key: "serial", label: "Serial" },
    { key: "model", label: "Model" },
    ...imeiCols,
    { key: "name", label: "Name" },
    { key: "software_connectivity", label: "Software" },
    { key: "status", label: "Status" },
  ];

  function renderActiveTables(rows: AssetCategoryRow[]) {
    if (rows.length === 0) {
      return (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">No active/pool assets in this type.</p>
      );
    }
    if (!groupByCompany) {
      return (
        <DataTable
          keyField="id"
          data={rows}
          hrefPrefix="/assets/"
          filterKeys={["status"]}
          searchPlaceholder="Search by name, serial, asset ID…"
          multiSelect={canBulkDelete}
          bulkDelete={canBulkDelete ? bulk : undefined}
          columns={activeColumns}
        />
      );
    }
    const byCompany = groupRowsByCompanyLabel(rows);
    return (
      <div className="space-y-8">
        {[...byCompany.entries()].map(([groupKey, { display, rows: groupRows }]) => (
          <div key={groupKey} id={companySectionAnchorId(groupKey)} className="scroll-mt-24">
            <h3 className="mb-2 text-sm font-semibold text-zinc-800">{display}</h3>
            <DataTable
              keyField="id"
              data={groupRows}
              hrefPrefix="/assets/"
              filterKeys={["status"]}
              searchPlaceholder="Search by name, serial, asset ID…"
              multiSelect={canBulkDelete}
              bulkDelete={canBulkDelete ? bulk : undefined}
              columns={activeColumns}
            />
          </div>
        ))}
      </div>
    );
  }

  function renderMaintenanceDamaged(rows: AssetCategoryRow[], emptyMsg: string) {
    if (rows.length === 0) {
      return <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">{emptyMsg}</p>;
    }
    if (!groupByCompany) {
      return (
        <DataTable
          keyField="id"
          data={rows}
          hrefPrefix="/assets/"
          searchPlaceholder="Search by name, serial, asset ID…"
          multiSelect={canBulkDelete}
          bulkDelete={canBulkDelete ? bulk : undefined}
          columns={maintenanceDamagedColumns}
        />
      );
    }
    const byCompany = groupRowsByCompanyLabel(rows);
    return (
      <div className="space-y-8">
        {[...byCompany.entries()].map(([groupKey, { display, rows: groupRows }]) => (
          <div key={groupKey} id={companySectionAnchorId(groupKey)} className="scroll-mt-24">
            <h3 className="mb-2 text-sm font-semibold text-zinc-800">{display}</h3>
            <DataTable
              keyField="id"
              data={groupRows}
              hrefPrefix="/assets/"
              searchPlaceholder="Search by name, serial, asset ID…"
              multiSelect={canBulkDelete}
              bulkDelete={canBulkDelete ? bulk : undefined}
              columns={maintenanceDamagedColumns}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Active / pool assets</h2>
        {renderActiveTables(activeRows)}
      </section>

      <section className="rounded-xl border border-orange-200 bg-orange-50/30 p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Under maintenance</h2>
        {renderMaintenanceDamaged(maintenanceRows, "No under-maintenance assets in this type.")}
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50/30 p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Damaged</h2>
        {renderMaintenanceDamaged(damagedRows, "No damaged assets in this type.")}
      </section>
    </>
  );
}
