"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PurchasePhotoUploader } from "@/components/assets/PurchasePhotoUploader";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";
import { EHS_TOOL_TYPES, getEhsToolType } from "@/lib/assets/ehs-tool-catalog";
import { FormActions, FormCard, FormCardSection, FormSection } from "@/components/ui/FormSection";

type EhsAsset = {
  id: string;
  asset_id: string | null;
  name: string;
  category: string;
  condition: string | null;
  status: string;
  ehs_tool_type: string | null;
  en_code: string | null;
  purchase_image_urls?: unknown;
} | null;

const selectClass = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm";
const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm";

export function EhsToolForm({ existing }: { existing: EhsAsset }) {
  const router = useRouter();
  const [toolTypeKey, setToolTypeKey] = useState(existing?.ehs_tool_type ?? "");
  const [condition, setCondition] = useState(existing?.condition ?? "");
  const [purchaseImageUrls, setPurchaseImageUrls] = useState<string[]>(() =>
    parseImageUrlArray(existing?.purchase_image_urls)
  );
  const [previewAssetId, setPreviewAssetId] = useState(existing?.asset_id ?? "");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toolDef = useMemo(() => (toolTypeKey ? getEhsToolType(toolTypeKey) : undefined), [toolTypeKey]);

  useEffect(() => {
    if (existing) return;
    if (!toolTypeKey) {
      setPreviewAssetId("");
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const qs = new URLSearchParams({ ehs_tool_type: toolTypeKey });
    fetch(`/api/ehs-tools/next-id?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPreviewAssetId(typeof d.asset_id === "string" ? d.asset_id : "");
      })
      .catch(() => {
        if (!cancelled) setPreviewAssetId("");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolTypeKey, existing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!existing && purchaseImageUrls.length < 2) {
      setError("Upload at least two intake photos.");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const res = await fetch(`/api/ehs-tools/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ condition, purchase_image_urls: purchaseImageUrls }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? "Save failed");
        router.push(`/ehs-tools/${existing.id}`);
        router.refresh();
        return;
      }

      const res = await fetch("/api/ehs-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ehs_tool_type: toolTypeKey,
          condition,
          purchase_image_urls: purchaseImageUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Create failed");
      router.push(`/ehs-tools/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FormCard>
        <FormCardSection>
          <FormSection
            title="EHS tool details"
            description="Tools are added to a global pool. Choose DT or Driver/Rigger when assigning."
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Tool type</label>
              <select
                value={toolTypeKey}
                onChange={(e) => setToolTypeKey(e.target.value)}
                required={!existing}
                disabled={!!existing}
                className={selectClass}
              >
                {!existing ? <option value="">Select tool type…</option> : null}
                {EHS_TOOL_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {toolDef ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm text-sky-950">
                <span className="font-medium">EN Code:</span> {toolDef.enCode}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Asset ID</label>
              <input
                readOnly
                value={existing?.asset_id ?? previewAssetId}
                placeholder={previewLoading ? "Calculating…" : "Select tool type"}
                className={`${inputClass} bg-zinc-50 font-mono text-sm`}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Condition (optional)</label>
              <input value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass} />
            </div>
          </FormSection>
        </FormCardSection>

        <FormCardSection>
          <FormSection title="Intake photos">
            <PurchasePhotoUploader
              purpose="asset-purchase"
              urls={purchaseImageUrls}
              onUrlsChange={setPurchaseImageUrls}
            />
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
            {saving ? "Saving…" : existing ? "Update" : "Add EHS tool"}
          </button>
          <button
            type="button"
            onClick={() => router.push(existing ? `/ehs-tools/${existing.id}` : "/ehs-tools")}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </FormActions>
      </FormCard>
    </form>
  );
}
