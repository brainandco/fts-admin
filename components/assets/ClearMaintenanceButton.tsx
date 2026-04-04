"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  assetId: string;
  /** When false, render nothing (caller checks assets.manage). */
  canClear: boolean;
  className?: string;
  label?: string;
  /** e.g. reload client-fetched lists after success */
  onCleared?: () => void | Promise<void>;
};

export function ClearMaintenanceButton({
  assetId,
  canClear,
  className = "",
  label = "Mark fixed — back in pool",
  onCleared,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!canClear) return null;

  async function onClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/clear-maintenance`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Request failed");
        setLoading(false);
        return;
      }
      await onCleared?.();
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? "Updating…" : label}
      </button>
    </div>
  );
}
