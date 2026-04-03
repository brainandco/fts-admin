"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, RowAction } from "@/components/ui/DataTable";
import { VehicleImport } from "@/components/vehicles/VehicleImport";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type VehicleRow = Record<string, unknown> & {
  id: string;
  status?: string;
  name_display?: string;
  plate_number: string;
  project_name?: string;
  region_name?: string;
};

/** All Vehicles tab: vehicle data only (no assignee columns) */
const ALL_VEHICLES_COLUMNS = [
  { key: "make", label: "Make", format: "text" as const },
  { key: "model", label: "Model", format: "text" as const },
  { key: "vehicle_type", label: "Vehicle type", format: "text" as const },
  { key: "plate_number", label: "Vehicle plate no.", format: "text" as const },
  { key: "rent_company", label: "Rent company", format: "text" as const },
  { key: "assignment_type", label: "Assignment type", format: "text" as const },
  { key: "status", label: "Status" },
];

/** Assigned tab: assignee + vehicle (no Status, no Rent company) */
const ASSIGNED_COLUMNS = [
  { key: "name_display", label: "Name" },
  { key: "designation", label: "Designation", format: "text" as const },
  { key: "contact", label: "Contact", format: "text" as const },
  { key: "plate_number", label: "Vehicle plate no.", format: "text" as const },
  { key: "vehicle_type", label: "Vehicle type", format: "text" as const },
  { key: "assignment_type", label: "Assignment type", format: "text" as const },
  { key: "project_name", label: "Project" },
  { key: "region_name", label: "Region" },
  { key: "make", label: "Make", format: "text" as const },
  { key: "model", label: "Model", format: "text" as const },
];

export function VehiclesTabs({
  allRows,
  assignedRows,
}: {
  allRows: VehicleRow[];
  assignedRows: VehicleRow[];
}) {
  const [tab, setTab] = useState<"all" | "assigned">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vehicles/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleting(false);
        alert(data.message || "Failed to delete vehicle");
        return;
      }
      setDeleteTarget(null);
      router.push("/vehicles");
      router.refresh();
    } catch {
      setDeleting(false);
      alert("Failed to delete vehicle");
    }
  };

  const allRowActions = (row: VehicleRow): RowAction<VehicleRow>[] => [
    { label: "View", href: `/vehicles/${row.id}` },
    { label: "Delete", onClick: () => setDeleteTarget({ id: row.id, label: row.plate_number || row.id }) },
  ];

  const assignedRowActions = (row: VehicleRow): RowAction<VehicleRow>[] => [
    { label: "View", href: `/vehicles/${row.id}` },
    { label: "Delete", onClick: () => setDeleteTarget({ id: row.id, label: row.plate_number || row.id }) },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Vehicles</h1>
      </div>

      <div className="mb-4 flex gap-1 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`rounded-t px-4 py-2 text-sm font-medium ${
            tab === "all"
              ? "border border-zinc-200 border-b-0 bg-white text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          All vehicles ({allRows.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("assigned")}
          className={`rounded-t px-4 py-2 text-sm font-medium ${
            tab === "assigned"
              ? "border border-zinc-200 border-b-0 bg-white text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          Assigned vehicles ({assignedRows.length})
        </button>
      </div>

      {tab === "all" && (
        <DataTable
          keyField="id"
          data={allRows}
          rowActions={allRowActions}
          selectable
          selectionLabelKey="plate_number"
          filterKeys={["status"]}
          searchPlaceholder="Search by plate, type, make, model…"
          toolbarTrailing={
            <>
              <VehicleImport />
              <Link href="/vehicles/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                Add vehicle
              </Link>
            </>
          }
          columns={ALL_VEHICLES_COLUMNS}
          emptyMessage="No vehicles. Add vehicles or import from CSV."
        />
      )}

      {tab === "assigned" && (
        <DataTable
          keyField="id"
          data={assignedRows}
          rowActions={assignedRowActions}
          selectable
          selectionLabelKey="plate_number"
          filterKeys={["project_name", "region_name"]}
          searchPlaceholder="Search by name, plate, project, region…"
          toolbarTrailing={
            <>
              <span className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Employee assignment is PM-only
              </span>
            </>
          }
          columns={ASSIGNED_COLUMNS}
          emptyMessage="No assigned vehicles."
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete vehicle"
        message={deleteTarget ? `Are you sure you want to delete this vehicle (${deleteTarget.label})? This cannot be undone.` : ""}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
