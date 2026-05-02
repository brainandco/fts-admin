"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfoModal } from "@/components/ui/InfoModal";

export function DeleteUserButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setBlockMessage(null);
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      if (data.code === "USER_HAS_ASSIGNMENTS" && data.message) {
        setBlockMessage(data.message);
        return;
      }
      setConfirming(false);
      setFailMessage(data.message || "Failed to delete user");
      return;
    }
    setConfirming(false);
    router.push("/users");
    router.refresh();
  }

  return (
    <>
      {confirming || blockMessage ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
          {blockMessage ? (
            <>
              <p className="mb-2 font-medium text-red-800">Cannot delete until the following are resolved:</p>
              <pre className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-red-800">{blockMessage}</pre>
              <button
                type="button"
                onClick={() => {
                  setBlockMessage(null);
                  setConfirming(false);
                }}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <span className="text-red-800">Delete {userEmail}? This cannot be undone.</span>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
        >
          Delete user
        </button>
      )}
      <InfoModal
        open={!!failMessage}
        title="Delete failed"
        message={failMessage ?? ""}
        variant="danger"
        onClose={() => setFailMessage(null)}
      />
    </>
  );
}
