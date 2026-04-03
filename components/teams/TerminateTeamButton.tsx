"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TerminateTeamButton({
  teamId,
  teamName,
  canTerminate,
  blockReason,
}: {
  teamId: string;
  teamName: string;
  canTerminate: boolean;
  blockReason: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleTerminate() {
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push("/teams");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to terminate team");
    }
  }

  if (!canTerminate) {
    return (
      <div className="max-w-xl text-right">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-400"
          title={blockReason ?? undefined}
        >
          Terminate team
        </button>
        {blockReason && (
          <p className="mt-2 text-xs text-amber-800">{blockReason}</p>
        )}
      </div>
    );
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-zinc-600">Terminate &quot;{teamName}&quot;?</span>
        <button
          type="button"
          onClick={handleTerminate}
          disabled={loading}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "…" : "Yes, terminate"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
    >
      Terminate team
    </button>
  );
}
