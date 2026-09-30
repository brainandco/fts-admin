"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

type Props = {
  apiPath: string;
  entityLabel: string;
  displayName: string;
  redirectTo: string;
  buttonLabel?: string;
};

/**
 * Hard-delete one inventory row (asset / EHS / SIM / etc.) with confirm — same pattern as vehicles.
 */
export function InventoryDeleteButton({
  apiPath,
  entityLabel,
  displayName,
  redirectTo,
  buttonLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    try {
      const res = await fetch(apiPath, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleting(false);
        setFailMessage(
          typeof data.message === "string" ? data.message : `Failed to delete ${entityLabel}`
        );
        return;
      }
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setDeleting(false);
      setFailMessage(`Failed to delete ${entityLabel}`);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {buttonLabel ?? `Delete ${entityLabel}`}
      </button>
      <ConfirmModal
        open={open}
        title={`Delete ${entityLabel}`}
        message={`Are you sure you want to delete this ${entityLabel} (${displayName})? This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={() => !deleting && setOpen(false)}
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
