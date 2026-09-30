"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type RowAction } from "@/components/ui/DataTable";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

export type SimInventoryRow = Record<string, unknown> & { id: string };

const bulk = {
  apiPath: "/api/sims/bulk-delete",
  entityLabel: "SIM cards",
  confirmTitle: "Delete selected SIM cards",
} as const;

export function SimsInventoryTables({
  canBulkDelete,
  canDelete = true,
  availableRows,
  assignedRows,
}: {
  canBulkDelete: boolean;
  /** Individual row Delete (assets.manage). Independent of bulk_delete.execute. */
  canDelete?: boolean;
  availableRows: SimInventoryRow[];
  assignedRows: SimInventoryRow[];
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sims/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleting(false);
        setFailMessage(typeof data.message === "string" ? data.message : "Failed to delete SIM");
        return;
      }
      setDeleteTarget(null);
      setDeleting(false);
      router.refresh();
    } catch {
      setDeleting(false);
      setFailMessage("Failed to delete SIM");
    }
  }

  const rowActions = (row: SimInventoryRow): RowAction<SimInventoryRow>[] => {
    const actions: RowAction<SimInventoryRow>[] = [{ label: "View", href: `/sims/${row.id}` }];
    if (canDelete) {
      actions.push({
        label: "Delete",
        onClick: () =>
          setDeleteTarget({
            id: row.id,
            label: String(row.sim_number || row.id),
          }),
      });
    }
    return actions;
  };

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
          rowActions={rowActions}
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
          rowActions={rowActions}
          columns={[
            { key: "sim_number", label: "SIM number" },
            { key: "operator", label: "Operator" },
            { key: "service_type", label: "Service" },
            { key: "assigned_name", label: "Assigned to" },
            { key: "status", label: "Status" },
          ]}
        />
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete SIM card"
        message={`Are you sure you want to delete this SIM (${deleteTarget?.label ?? ""})? This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
      <InfoModal
        open={!!failMessage}
        title="Could not delete"
        message={failMessage ?? ""}
        variant="danger"
        onClose={() => setFailMessage(null)}
      />
    </>
  );
}
