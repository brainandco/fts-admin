"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export function VehicleDeleteButton({ vehicleId, label }: { vehicleId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleting(false);
        alert(data.message || "Failed to delete vehicle");
        return;
      }
      setOpen(false);
      router.push("/vehicles");
      router.refresh();
    } catch {
      setDeleting(false);
      alert("Failed to delete vehicle");
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
    </>
  );
}
