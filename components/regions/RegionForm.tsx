"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormActions, FormCard, FormCardSection, FormSection } from "@/components/ui/FormSection";

type Region = { id: string; name: string; code: string | null } | null;

export function RegionForm({ existing }: { existing: Region }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(existing ? `/api/regions/${existing.id}` : "/api/regions", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), code: code.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    router.push("/regions");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <form onSubmit={submit} className="max-w-lg">
      <FormCard>
        <FormCardSection>
          <FormSection title="Region" description="Name and optional short code for filters and reports.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Code</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
              </div>
            </div>
          </FormSection>
        </FormCardSection>
        {error ? (
          <FormCardSection>
            <p className="text-sm text-red-600">{error}</p>
          </FormCardSection>
        ) : null}
        <FormActions>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : existing ? "Update" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </FormActions>
      </FormCard>
    </form>
  );
}
