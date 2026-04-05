"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfoModal } from "@/components/ui/InfoModal";

const CONFIRM_PHRASE = "DELETE_ALL_ASSETS";

/**
 * Destructive: removes every row in `assets` (including items assigned to employees).
 * Server also clears `resource_receipt_confirmations` for assets; FK CASCADE handles history/returns.
 * Render only when user has `bulk_delete.execute` (see parent page).
 */
export function AssetsDeleteAllPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultModal, setResultModal] = useState<{ title: string; message: string; variant: "success" | "danger" } | null>(
    null
  );

  async function runDelete() {
    if (phrase.trim() !== CONFIRM_PHRASE) {
      setError(`Type ${CONFIRM_PHRASE} exactly.`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/assets/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true, confirm: CONFIRM_PHRASE }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setOpen(false);
        setPhrase("");
        setResultModal({
          title: "Could not delete",
          message: typeof data.message === "string" ? data.message : "Delete failed.",
          variant: "danger",
        });
        return;
      }
      const n = typeof data.deletedCount === "number" ? data.deletedCount : 0;
      setOpen(false);
      setPhrase("");
      setResultModal({
        title: "All assets removed",
        message: `Deleted ${n} asset record(s). You can import a new catalog from the Import button.`,
        variant: "success",
      });
      router.refresh();
    } catch {
      setBusy(false);
      setError("Request failed");
    }
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
      <h2 className="text-lg font-medium text-rose-950">Delete all assets</h2>
      <p className="mt-2 text-sm text-rose-900/90">
        Removes <strong>every</strong> asset record, including those currently assigned to employees. You do not need to
        unassign or return them first. Requires the <strong>Execute bulk deletes</strong> permission (assigned by a Super
        User). Afterward, use <strong>Import</strong> to load the new catalog.
      </p>
      <p className="mt-2 text-sm text-rose-800/80">
        To delete only some items, open a category under <strong>Quantity by type</strong> and use the table checkboxes
        → <strong>Delete selected</strong>.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setPhrase("");
            setError("");
          }}
          className="mt-4 rounded border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
        >
          I understand — delete all assets…
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-rose-200 bg-white p-4">
          <p className="text-sm text-zinc-700">
            Type <code className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs">{CONFIRM_PHRASE}</code> to confirm.
          </p>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || phrase.trim() !== CONFIRM_PHRASE}
              onClick={() => void runDelete()}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete all assets now"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setPhrase("");
                setError("");
              }}
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <InfoModal
        open={resultModal !== null}
        title={resultModal?.title ?? ""}
        message={resultModal?.message ?? ""}
        variant={resultModal?.variant === "danger" ? "danger" : "success"}
        onClose={() => setResultModal(null)}
      />
    </div>
  );
}
