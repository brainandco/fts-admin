"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProfileUpdateRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(status: "completed" | "dismissed") {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/employee-profile-update-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Update failed");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void act("completed")}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Mark completed"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void act("dismissed")}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Mark <span className="font-medium">completed</span> after you have updated the employee in People. Use{" "}
        <span className="font-medium">dismiss</span> if the request will not be applied.
      </p>
    </div>
  );
}
