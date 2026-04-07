"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PurchasePhotoUploader } from "@/components/assets/PurchasePhotoUploader";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";

type Employee = { id: string; full_name: string; region_id?: string };
type Asset = {
  id: string;
  asset_id: string | null;
  name: string;
  category: string;
  serial: string | null;
  condition: string | null;
  status: string;
  assigned_to_employee_id?: string | null;
  specs?: Record<string, unknown> | null;
  software_connectivity?: string | null;
  imei_1?: string | null;
  imei_2?: string | null;
  model?: string | null;
  purchase_image_urls?: unknown;
} | null;

function parseSpecs(specs: Record<string, unknown> | null | undefined): { company: string; ram: string } {
  if (!specs || typeof specs !== "object") return { company: "", ram: "" };
  return {
    company: typeof specs.company === "string" ? specs.company : "",
    ram: typeof specs.ram === "string" ? specs.ram : "",
  };
}

function buildSpecs(company: string, ram: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (company.trim()) out.company = company.trim();
  if (ram.trim()) out.ram = ram.trim();
  return out;
}

export function AssetForm({
  existing,
  qcEmployees = [],
}: {
  existing: Asset;
  qcEmployees?: Employee[];
}) {
  const router = useRouter();
  const initialSpecs = parseSpecs(existing?.specs);
  const [category, setCategory] = useState(existing?.category ?? "");
  const [serial, setSerial] = useState(existing?.serial ?? "");
  const [imei1, setImei1] = useState(existing?.imei_1 ?? "");
  const [imei2, setImei2] = useState(existing?.imei_2 ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [specCompany, setSpecCompany] = useState(initialSpecs.company || (existing?.name ?? "").trim() || "");
  const [specRam, setSpecRam] = useState(initialSpecs.ram);
  const [condition, setCondition] = useState(existing?.condition ?? "");
  const [softwareConnectivity, setSoftwareConnectivity] = useState(existing?.software_connectivity ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [purchaseImageUrls, setPurchaseImageUrls] = useState<string[]>(() =>
    parseImageUrlArray(existing?.purchase_image_urls)
  );
  const [previewAssetId, setPreviewAssetId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const showImeiFields = /mobile/i.test(category);

  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!category.trim()) {
        setPreviewAssetId("");
        return;
      }
      setPreviewLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("category", category.trim());
        qs.set("company", specCompany.trim());
        const res = await fetch(`/api/assets/next-asset-id?${qs.toString()}`);
        const data = (await res.json().catch(() => ({}))) as { asset_id?: string | null };
        if (cancelled) return;
        setPreviewAssetId(typeof data.asset_id === "string" && data.asset_id ? data.asset_id : "");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [existing, category, specCompany]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!specCompany.trim()) {
      setError("Company / brand is required.");
      return;
    }
    setSaving(true);
    const url = existing ? `/api/assets/${existing.id}` : "/api/assets";
    const body: Record<string, unknown> = {
      asset_id: existing ? existing.asset_id : null,
      name: specCompany.trim(),
      category,
      serial: serial || null,
      imei_1: imei1.trim() || null,
      imei_2: imei2.trim() || null,
      model: model.trim() || null,
      specs: buildSpecs(specCompany, specRam),
      condition: condition || null,
      software_connectivity: softwareConnectivity.trim() || null,
      purchase_image_urls: purchaseImageUrls,
    };
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    const redirectId = existing ? existing.id : data.id;
    if (redirectId) {
      router.push(`/assets/${redirectId}`);
      router.refresh();
    } else {
      router.push("/assets");
      router.refresh();
    }
  }

  const assetIdShown = existing ? (existing.asset_id ?? "") : previewAssetId;
  const assetIdPlaceholder = existing ? "—" : previewLoading ? "Calculating…" : "Select asset type (and company for Laptop / Mobile)";

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Asset ID</label>
        <input
          value={assetIdShown}
          readOnly
          disabled
          className="w-full cursor-not-allowed rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
          placeholder={assetIdPlaceholder}
        />
        <p className="mt-1 text-xs text-zinc-500">
          {existing
            ? "Asset ID does not change after creation."
            : "Assigned on save from the next number in sequence. Laptop/Mobile use short brand codes (e.g. Samsung → SS, Huawei → HU, Dell → DELL, iPhone → IPHONE); other brands use a compact uppercase form."}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Serial number</label>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Primary tracking identifier"
        />
      </div>
      {showImeiFields ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">IMEI 1</label>
              <input
                value={imei1}
                onChange={(e) => setImei1(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono"
                placeholder="e.g. 15-digit IMEI"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">IMEI 2</label>
              <input
                value={imei2}
                onChange={(e) => setImei2(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono"
                placeholder="Dual-SIM / second slot (optional)"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-zinc-500">Used for mobile devices with SIM support.</p>
        </>
      ) : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Asset type</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. Laptop, Mobile, GPS, USB Hub…"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Use exact labels for auto IDs: Laptop, Mobile, GPS, Inverter, Data Cable, Charger, Dongle, Router, Power Bank, USB
          Hub, Aramco Digital/Device, Aramco Mobile Device.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Company / brand</label>
          <input
            value={specCompany}
            onChange={(e) => setSpecCompany(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="e.g. Dell, HP"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">RAM (if applicable)</label>
          <input
            value={specRam}
            onChange={(e) => setSpecRam(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="e.g. 16GB"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Model</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. Latitude 5520, SM-G991B, manufacturer model/SKU"
        />
        <p className="mt-1 text-xs text-zinc-500">Optional. Specific model or part number for this item.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Condition</label>
        <input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. Good, Fair"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Software connectivity</label>
        <input
          value={softwareConnectivity}
          onChange={(e) => setSoftwareConnectivity(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. probe, TEMS, probe and TEMS, NEMO, PHU"
        />
        <p className="mt-1 text-xs text-zinc-500">What software or tools this asset is used with (free text).</p>
      </div>
      <PurchasePhotoUploader purpose="asset-purchase" urls={purchaseImageUrls} onUrlsChange={setPurchaseImageUrls} />
      {existing ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
          <span className="font-medium text-zinc-700">Current status: </span>
          <span className="text-zinc-900">{existing.status}</span>
          <p className="mt-1 text-xs text-zinc-500">
            New assets are <strong>Available</strong>. Assignment sets <strong>Assigned</strong>.
            <strong> Under Maintenance</strong> are set only when you process an employee return (Asset returns queue).
            <strong> Pending_Return</strong> means the employee returned it and is waiting for your decision.
          </p>
        </div>
      ) : null}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : existing ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
