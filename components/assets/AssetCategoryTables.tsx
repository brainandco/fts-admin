"use client";

import { DataTable } from "@/components/ui/DataTable";

export type AssetCategoryRow = Record<string, unknown> & { id: string };

const bulk = {
  apiPath: "/api/assets/bulk-delete",
  entityLabel: "assets",
  confirmTitle: "Delete selected assets",
} as const;

export function AssetCategoryTables({
  showImei,
  activeRows,
  maintenanceRows,
  damagedRows,
}: {
  showImei: boolean;
  activeRows: AssetCategoryRow[];
  maintenanceRows: AssetCategoryRow[];
  damagedRows: AssetCategoryRow[];
}) {
  const imeiCols = showImei
    ? ([{ key: "imei_1", label: "IMEI 1" }, { key: "imei_2", label: "IMEI 2" }] as const)
    : [];

  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Active / pool assets</h2>
        {activeRows.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">No active/pool assets in this type.</p>
        ) : (
          <DataTable
            keyField="id"
            data={activeRows}
            hrefPrefix="/assets/"
            filterKeys={["status"]}
            searchPlaceholder="Search by name, serial…"
            multiSelect
            bulkDelete={bulk}
            columns={[
              { key: "name", label: "Name" },
              { key: "model", label: "Model" },
              { key: "serial", label: "Serial" },
              ...imeiCols,
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
            multiSelect
            bulkDelete={bulk}
            columns={[
              { key: "serial", label: "Serial" },
              { key: "model", label: "Model" },
              ...imeiCols,
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
            multiSelect
            bulkDelete={bulk}
            columns={[
              { key: "serial", label: "Serial" },
              { key: "model", label: "Model" },
              ...imeiCols,
              { key: "name", label: "Name" },
              { key: "software_connectivity", label: "Software" },
              { key: "status", label: "Status" },
            ]}
          />
        )}
      </section>
    </>
  );
}
