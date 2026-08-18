"use client";

import { useState } from "react";

export function ProvisionDriverLoginsButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    const ok = window.confirm(
      "This sets a new random password for every ACTIVE Driver/Rigger and downloads a sheet. The previous sheet will stop working. Continue?"
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/employees/provision-driver-logins", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.message === "string" ? data.message : `Failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `driver-rigger-logins-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onClick()}
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? "Preparing sheet…" : "Driver/Rigger login sheet"}
      </button>
      {error ? <p className="max-w-xs text-right text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
