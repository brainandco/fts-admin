"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncTeamFromDtButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/sync-region-project-from-dt`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Sync failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
      >
        {loading ? "Syncing…" : "Sync region & project from DT"}
      </button>
      <p className="max-w-[14rem] text-right text-[11px] leading-snug text-zinc-500">
        Updates this team row from the DT&apos;s employee record (same as saving the team form). Use after changing the DT&apos;s project under Region &amp; project assignments.
      </p>
      {error ? <p className="max-w-[14rem] text-right text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
