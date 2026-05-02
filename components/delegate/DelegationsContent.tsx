"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

type User = { id: string; email: string | null; full_name: string | null };
type DelegationRow = {
  id: string;
  delegator_user_id: string;
  delegatee_user_id: string;
  from_date: string;
  to_date: string;
  notes: string | null;
  created_at: string;
  delegator: User;
  delegatee: User;
};

export function DelegationsContent() {
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
  const [delegateeId, setDelegateeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [notes, setNotes] = useState("");
  const [forbidden, setForbidden] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setForbidden("");
    Promise.all([fetch("/api/delegations"), fetch("/api/delegations/eligible-delegatees")])
      .then(async ([delegationsRes, usersRes]) => {
        const delegationsJson = await delegationsRes.json();
        const usersJson = await usersRes.json();
        if (delegationsRes.status === 403 || usersRes.status === 403) {
          setForbidden(delegationsJson.message || usersJson.message || "You do not have access to delegation.");
          setDelegations([]);
          setUsers([]);
          return;
        }
        if (delegationsJson.delegations) setDelegations(delegationsJson.delegations);
        if (usersJson.users) setUsers(usersJson.users);
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!delegateeId || !fromDate || !toDate) {
      setError("Select delegatee and set from/to dates.");
      return;
    }
    if (toDate < fromDate) {
      setError("To date must be on or after from date.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delegatee_user_id: delegateeId, from_date: fromDate, to_date: toDate, notes: notes.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to create delegation");
      return;
    }
    setDelegateeId("");
    setFromDate("");
    setToDate("");
    setNotes("");
    const listRes = await fetch("/api/delegations");
    const listData = await listRes.json().catch(() => ({}));
    if (listRes.status === 403) {
      setForbidden(listData.message || "You do not have access to delegation.");
      setDelegations([]);
      return;
    }
    if (listData.delegations) setDelegations(listData.delegations);
  }

  async function confirmDeleteDelegation() {
    const p = pendingDelete;
    if (!p) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/delegations/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        setPendingDelete(null);
        setDelegations((prev) => prev.filter((d) => d.id !== p.id));
      } else {
        const data = await res.json().catch(() => ({}));
        setInfoModal({
          title: "Could not remove",
          message: typeof data.message === "string" ? data.message : "Failed to delete",
        });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  if (forbidden) {
    return <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{forbidden}</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Create delegation</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Only admin users appear here. Super Users can delegate to any admin; other admins cannot delegate to a Super User.
        </p>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4 rounded border border-zinc-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Delegate to</label>
            <select value={delegateeId} onChange={(e) => setDelegateeId(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Select user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">From date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">To date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="rounded border border-zinc-300 px-3 py-2 text-sm w-48" />
          </div>
          <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            {saving ? "Saving…" : "Create delegation"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Your delegations</h2>
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-2 text-left font-medium text-zinc-700">You (delegator)</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Delegatee</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">From</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">To</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Status</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Notes</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {delegations.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-4 text-zinc-500">No delegations yet. Create one above.</td></tr>
              ) : (
                delegations.map((d) => {
                  const active = today >= d.from_date && today <= d.to_date;
                  return (
                    <tr key={d.id} className="border-b border-zinc-100">
                      <td className="px-4 py-2">{d.delegator.full_name || d.delegator.email || "—"}</td>
                      <td className="px-4 py-2">{d.delegatee.full_name || d.delegatee.email || "—"}</td>
                      <td className="px-4 py-2">{d.from_date}</td>
                      <td className="px-4 py-2">{d.to_date}</td>
                      <td className="px-4 py-2">
                        <span className={active ? "text-green-600 font-medium" : "text-zinc-500"}>{active ? "Active" : "Inactive"}</span>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{d.notes || "—"}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              id: d.id,
                              label: d.delegatee.full_name || d.delegatee.email || "this delegatee",
                            })
                          }
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={!!pendingDelete}
        title="Remove delegation?"
        message={
          pendingDelete
            ? `Remove delegation to ${pendingDelete.label}? They will lose acting access for the configured period.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setPendingDelete(null)}
        onConfirm={() => void confirmDeleteDelegation()}
      />

      <InfoModal
        open={!!infoModal}
        title={infoModal?.title ?? ""}
        message={infoModal?.message ?? ""}
        variant="danger"
        onClose={() => setInfoModal(null)}
      />
    </div>
  );
}
