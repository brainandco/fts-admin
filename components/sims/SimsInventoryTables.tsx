"use client";

import { DataTable } from "@/components/ui/DataTable";

export type SimInventoryRow = Record<string, unknown> & { id: string };

const bulk = {
  apiPath: "/api/sims/bulk-delete",
  entityLabel: "SIM cards",
  confirmTitle: "Delete selected SIM cards",
} as const;

export function SimsInventoryTables({
  canBulkDelete,
  availableRows,
  assignedRows,
}: {
  canBulkDelete: boolean;
  availableRows: SimInventoryRow[];
  assignedRows: SimInventoryRow[];
}) {
  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Available SIMs</h2>
        <DataTable
          keyField="id"
          data={availableRows}
          hrefPrefix="/sims/"
          filterKeys={["operator", "service_type"]}
          searchPlaceholder="Search by sim number, operator..."
          multiSelect={canBulkDelete}
          bulkDelete={canBulkDelete ? bulk : undefined}
          columns={[
            { key: "sim_number", label: "SIM number" },
            { key: "phone_number", label: "Phone number" },
            { key: "operator", label: "Operator" },
            { key: "service_type", label: "Service" },
            { key: "status", label: "Status" },
          ]}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Assigned SIMs</h2>
        <DataTable
          keyField="id"
          data={assignedRows}
          hrefPrefix="/sims/"
          filterKeys={["operator", "service_type"]}
          searchPlaceholder="Search by sim number, imei..."
          multiSelect={canBulkDelete}
          bulkDelete={canBulkDelete ? bulk : undefined}
          columns={[
            { key: "sim_number", label: "SIM number" },
            { key: "operator", label: "Operator" },
            { key: "service_type", label: "Service" },
            { key: "assigned_name", label: "Assigned to" },
            { key: "status", label: "Status" },
          ]}
        />
      </section>
    </>
  );
}
