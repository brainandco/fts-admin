"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

export function VehicleUnassignButton({ vehicleId, label }: { vehicleId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unassign: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        setFailMessage(data.message || "Failed to unassign");
        return;
      }
      setOpen(false);
      router.push("/vehicles");
      router.refresh();
    } catch {
      setLoading(false);
      setFailMessage("Failed to unassign");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
      >
        Unassign
      </button>
      <ConfirmModal
        open={open}
        title="Unassign vehicle"
        message={`Remove assignment from "${label}"? The vehicle will become Available and can be assigned to another employee.`}
        confirmLabel="Yes, unassign"
        cancelLabel="Cancel"
        variant="danger"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => !loading && setOpen(false)}
      />
      <InfoModal
        open={!!failMessage}
        title="Could not unassign"
        message={failMessage ?? ""}
        variant="danger"
        onClose={() => setFailMessage(null)}
      />
    </>
  );
}
