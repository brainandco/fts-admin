"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

export type EhsListRow = {
  id: string;
  asset_id: string;
  name: string;
  en_code: string | null;
  status: string;
  ehs_wear_role: string | null;
  assigned_to_employee_id: string | null;
  assignee_name: string;
};

export function EhsToolsListTable({ rows }: { rows: EhsListRow[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleting(false);
        setFailMessage(typeof data.message === "string" ? data.message : "Failed to delete EHS tool");
        return;
      }
      setDeleteTarget(null);
      setDeleting(false);
      router.refresh();
    } catch {
      setDeleting(false);
      setFailMessage("Failed to delete EHS tool");
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Asset ID</th>
              <th className="px-4 py-2">Tool</th>
              <th className="px-4 py-2">Assigned as</th>
              <th className="px-4 py-2">EN Code</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Assigned to (DT)</th>
              <th className="px-4 py-2 text-right">Actions</th>
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
                <td className="px-4 py-2">
                  {!r.assigned_to_employee_id
                    ? "—"
                    : r.ehs_wear_role === "driver_rigger"
                      ? "Driver/Rigger"
                      : r.ehs_wear_role === "dt"
                        ? "DT"
                        : "—"}
                </td>
                <td className="px-4 py-2 text-xs">{r.en_code ?? "—"}</td>
                <td className="px-4 py-2">{r.status.replace(/_/g, " ")}</td>
                <td className="px-4 py-2">{r.assignee_name}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/ehs-tools/${r.id}`}
                      className="rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: r.id, label: r.asset_id || r.name })}
                      className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">No EHS tools yet. Add the first tool above.</p>
        ) : null}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete EHS tool"
        message={`Are you sure you want to delete this EHS tool (${deleteTarget?.label ?? ""})? This cannot be undone.`}
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
