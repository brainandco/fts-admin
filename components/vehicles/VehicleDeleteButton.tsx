"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";

export function VehicleDeleteButton({ vehicleId, label }: { vehicleId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleting(false);
        setFailMessage(data.message || "Failed to delete vehicle");
        return;
      }
      setOpen(false);
      router.push("/vehicles");
      router.refresh();
    } catch {
      setDeleting(false);
      setFailMessage("Failed to delete vehicle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {label}
      </button>
      <ConfirmModal
        open={open}
        title="Delete vehicle"
        message={`Are you sure you want to delete this vehicle (${label})? This cannot be undone.`}
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
