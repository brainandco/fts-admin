"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoModal } from "@/components/ui/InfoModal";

const CONFIRM_PHRASE = "UNASSIGN_ALL_ASSETS";

export type RegionOption = { id: string; name: string };

type ScopeMode = "region" | "all";

/**
 * Bulk unassign every asset currently assigned to an employee (Admin portal — assets.manage only).
 */
export function BulkUnassignAssetsPanel({
  regions,
  apiBase = "/api/assets/bulk-unassign",
}: {
  regions: RegionOption[];
  apiBase?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("region");
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultModal, setResultModal] = useState<{ title: string; message: string; variant: "success" | "danger" } | null>(
    null
  );

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const q =
        scopeMode === "all"
          ? `${apiBase}?all_regions=1`
          : `${apiBase}?region_id=${encodeURIComponent(regionId)}`;
      const res = await fetch(q);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreviewCount(null);
        return;
      }
      setPreviewCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [apiBase, regionId, scopeMode]);

  useEffect(() => {
    if (!open) return;
    if (scopeMode === "region" && !regionId) {
      setPreviewCount(0);
      return;
    }
    void loadPreview();
  }, [open, scopeMode, regionId, loadPreview]);

  async function runUnassign() {
    if (phrase.trim() !== CONFIRM_PHRASE) {
      setError(`Type ${CONFIRM_PHRASE} exactly.`);
      return;
    }
    if (scopeMode === "region" && !regionId) {
      setError("Select a region.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: CONFIRM_PHRASE,
          all_regions: scopeMode === "all",
          region_id: scopeMode === "region" ? regionId : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setOpen(false);
        setPhrase("");
        setResultModal({
          title: "Could not unassign",
          message: typeof data.message === "string" ? data.message : "Bulk unassign failed.",
          variant: "danger",
        });
        return;
      }
      const n = typeof data.unassignedCount === "number" ? data.unassignedCount : 0;
      setOpen(false);
      setPhrase("");
      setResultModal({
        title: "Assets unassigned",
        message: `Unassigned ${n} asset(s). They are now Available in the pool and ready for reassignment.`,
        variant: "success",
      });
      router.refresh();
    } catch {
      setBusy(false);
      setError("Request failed");
    }
  }

  const regionLabel = regions.find((r) => r.id === regionId)?.name ?? "selected region";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <h2 className="text-lg font-medium text-amber-950">Bulk unassign assets</h2>
      <p className="mt-2 text-sm text-amber-900/90">
        Remove <strong>all current employee assignments</strong> in one step — for example after importing updated asset
        data and before re-assigning to your team. Assets become <strong>Available</strong> in the pool (region tags are
        kept). Only administrators can use this action.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
        >
          Unassign all assigned assets…
        </button>
      ) : (
        <div className="mt-4 space-y-4 rounded-lg border border-amber-200 bg-white p-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-800">Scope</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="unassign-scope"
                checked={scopeMode === "region"}
                onChange={() => setScopeMode("region")}
              />
              One region
            </label>
            {scopeMode === "region" && (
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="ml-6 block w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                {regions.length === 0 ? (
                  <option value="">No regions</option>
                ) : (
                  regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))
                )}
              </select>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="unassign-scope"
                checked={scopeMode === "all"}
                onChange={() => setScopeMode("all")}
              />
              All regions (organization-wide)
            </label>
          </fieldset>

          <p className="text-sm text-zinc-600">
            {previewLoading ? (
              "Counting assigned assets…"
            ) : previewCount != null ? (
              <>
                <strong>{previewCount}</strong> asset(s) will be unassigned
                {scopeMode === "region" ? ` in ${regionLabel}` : " across all regions"}.
              </>
            ) : (
              "Could not load preview count."
            )}
          </p>

          <div>
            <label htmlFor="bulk-unassign-confirm" className="mb-1 block text-sm font-medium text-zinc-700">
              Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
            </label>
            <input
              id="bulk-unassign-confirm"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
              autoComplete="off"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || previewCount === 0}
              onClick={() => void runUnassign()}
              className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {busy ? "Unassigning…" : "Unassign now"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setPhrase("");
                setError("");
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {resultModal ? (
        <InfoModal
          open
          title={resultModal.title}
          message={resultModal.message}
          variant={resultModal.variant}
          onClose={() => setResultModal(null)}
        />
      ) : null}
    </div>
  );
}
