"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleTerminate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmOpen(false);
        router.push("/teams");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setFailMessage(data.message || "Failed to terminate team");
      }
    } finally {
      setLoading(false);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Terminate team
      </button>
      <ConfirmModal
        open={confirmOpen}
        title="Terminate team?"
        message={`Terminate “${teamName}”? This removes the team and related data. This cannot be undone.`}
        confirmLabel="Yes, terminate"
        cancelLabel="Cancel"
        variant="danger"
        loading={loading}
        onConfirm={() => void handleTerminate()}
        onCancel={() => !loading && setConfirmOpen(false)}
      />
      <InfoModal
        open={!!failMessage}
        title="Could not terminate"
        message={failMessage ?? ""}
        variant="danger"
        onClose={() => setFailMessage(null)}
      />
    </>
  );
}
