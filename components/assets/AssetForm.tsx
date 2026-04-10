"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PurchasePhotoUploader } from "@/components/assets/PurchasePhotoUploader";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";
import { formatCompanyDisplayName } from "@/lib/assets/company-display";
import {
  ASSET_TYPE_PRESETS,
  ASSET_TYPE_OTHER_VALUE,
  BRAND_OTHER_VALUE,
  MODEL_OTHER_VALUE,
  LAPTOP_COMPANY_PRESETS,
  matchPresetCategory,
  mobileModelsForCompany,
  MOBILE_COMPANY_PRESETS,
  isLaptopCategory,
  isMobileCategory,
} from "@/lib/assets/asset-tool-form-options";

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

function initMobileBrand(company: string): { choice: string; other: string } {
  const c = company.trim();
  if (!c) return { choice: "", other: "" };
  if ((MOBILE_COMPANY_PRESETS as readonly string[]).includes(c as (typeof MOBILE_COMPANY_PRESETS)[number])) {
    return { choice: c, other: "" };
  }
  return { choice: BRAND_OTHER_VALUE, other: c };
}

function initMobileModel(company: string, modelStr: string): { choice: string; other: string } {
  const co = company.trim();
  const m = modelStr.trim();
  if (!co) return { choice: "", other: "" };
  const list = mobileModelsForCompany(co);
  if (m && list.includes(m)) return { choice: m, other: "" };
  if (m) return { choice: MODEL_OTHER_VALUE, other: m };
  return { choice: "", other: "" };
}

function initLaptopBrand(company: string): { choice: string; other: string } {
  const c = company.trim();
  if (!c) return { choice: "", other: "" };
  if ((LAPTOP_COMPANY_PRESETS as readonly string[]).includes(c as (typeof LAPTOP_COMPANY_PRESETS)[number])) {
    return { choice: c, other: "" };
  }
  return { choice: BRAND_OTHER_VALUE, other: c };
}

const selectClass = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm";
const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm";

export function AssetForm({
  existing,
  qcEmployees: _qcEmployees = [],
}: {
  existing: Asset;
  qcEmployees?: Employee[];
}) {
  const router = useRouter();
  const initialSpecs = parseSpecs(existing?.specs);
  const initCat = existing?.category?.trim() ?? "";
  const initCompany = initialSpecs.company || (existing?.name ?? "").trim();
  const initModel = (existing?.model ?? "").trim();

  const matchedPreset = matchPresetCategory(initCat);
  const [assetTypeChoice, setAssetTypeChoice] = useState<string>(
    () => (matchedPreset ? matchedPreset : initCat ? ASSET_TYPE_OTHER_VALUE : "")
  );
  const [assetTypeOther, setAssetTypeOther] = useState(() => (matchedPreset ? "" : initCat));

  const [serial, setSerial] = useState(existing?.serial ?? "");
  const [imei1, setImei1] = useState(existing?.imei_1 ?? "");
  const [imei2, setImei2] = useState(existing?.imei_2 ?? "");
  const [model, setModel] = useState(initModel);
  const [specCompany, setSpecCompany] = useState(initCompany);
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

  const mbInit = initCat && isMobileCategory(initCat) ? initMobileBrand(initCompany) : { choice: "", other: "" };
  const [mobileBrandChoice, setMobileBrandChoice] = useState(mbInit.choice);
  const [mobileBrandOther, setMobileBrandOther] = useState(mbInit.other);
  const mmInit =
    initCat && isMobileCategory(initCat) ? initMobileModel(initCompany, initModel) : { choice: "", other: "" };
  const [mobileModelChoice, setMobileModelChoice] = useState(mmInit.choice);
  const [mobileModelOther, setMobileModelOther] = useState(mmInit.other);

  const lbInit = initCat && isLaptopCategory(initCat) ? initLaptopBrand(initCompany) : { choice: "", other: "" };
  const [laptopBrandChoice, setLaptopBrandChoice] = useState(lbInit.choice);
  const [laptopBrandOther, setLaptopBrandOther] = useState(lbInit.other);

  const effectiveCategory = useMemo(
    () => (assetTypeChoice === ASSET_TYPE_OTHER_VALUE ? assetTypeOther.trim() : assetTypeChoice.trim()),
    [assetTypeChoice, assetTypeOther]
  );

  const isMobile = isMobileCategory(effectiveCategory);
  const isLaptop = isLaptopCategory(effectiveCategory);

  const showImeiFields = isMobile;
  const mobileCompanyEffective =
    mobileBrandChoice === BRAND_OTHER_VALUE ? mobileBrandOther.trim() : mobileBrandChoice.trim();
  const mobileModelsList = useMemo(() => mobileModelsForCompany(mobileCompanyEffective), [mobileCompanyEffective]);

  useEffect(() => {
    if (isMobile) {
      setSpecCompany(mobileCompanyEffective);
    } else if (isLaptop) {
      const c = laptopBrandChoice === BRAND_OTHER_VALUE ? laptopBrandOther.trim() : laptopBrandChoice.trim();
      setSpecCompany(c);
    }
  }, [isMobile, isLaptop, mobileCompanyEffective, laptopBrandChoice, laptopBrandOther]);

  useEffect(() => {
    if (!isMobile) return;
    const m = mobileModelChoice === MODEL_OTHER_VALUE ? mobileModelOther.trim() : mobileModelChoice.trim();
    setModel(m);
  }, [isMobile, mobileModelChoice, mobileModelOther]);

  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!effectiveCategory) {
        setPreviewAssetId("");
        return;
      }
      setPreviewLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("category", effectiveCategory);
        qs.set("company", formatCompanyDisplayName(specCompany.trim()) || specCompany.trim());
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
  }, [existing, effectiveCategory, specCompany]);

  function onAssetTypeSelectChange(v: string) {
    setAssetTypeChoice(v);
    if (v !== ASSET_TYPE_OTHER_VALUE) setAssetTypeOther("");
    setMobileBrandChoice("");
    setMobileBrandOther("");
    setMobileModelChoice("");
    setMobileModelOther("");
    setLaptopBrandChoice("");
    setLaptopBrandOther("");
    if (v !== ASSET_TYPE_OTHER_VALUE && v && !isMobileCategory(v) && !isLaptopCategory(v)) {
      setSpecCompany("");
      setModel("");
    }
  }

  function onMobileBrandSelectChange(v: string) {
    setMobileBrandChoice(v);
    if (v !== BRAND_OTHER_VALUE) setMobileBrandOther("");
    setMobileModelChoice("");
    setMobileModelOther("");
  }

  function onLaptopBrandSelectChange(v: string) {
    setLaptopBrandChoice(v);
    if (v !== BRAND_OTHER_VALUE) setLaptopBrandOther("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const category = effectiveCategory;
    if (!category) {
      setError("Asset type is required.");
      return;
    }

    let companyRaw = specCompany.trim();
    let modelRaw = model.trim();

    if (isMobile) {
      companyRaw = mobileBrandChoice === BRAND_OTHER_VALUE ? mobileBrandOther.trim() : mobileBrandChoice.trim();
      modelRaw =
        mobileModelChoice === MODEL_OTHER_VALUE ? mobileModelOther.trim() : mobileModelChoice.trim();
    } else if (isLaptop) {
      companyRaw = laptopBrandChoice === BRAND_OTHER_VALUE ? laptopBrandOther.trim() : laptopBrandChoice.trim();
      modelRaw = model.trim();
    }

    if (!companyRaw) {
      setError("Company / brand is required.");
      return;
    }
    if (isMobile && mobileBrandChoice === BRAND_OTHER_VALUE && !mobileBrandOther.trim()) {
      setError("Enter a custom company name or choose a listed brand.");
      return;
    }
    if (isMobile && mobileModelChoice === MODEL_OTHER_VALUE && !mobileModelOther.trim()) {
      setError("Enter a custom model or choose a listed model.");
      return;
    }
    if (isLaptop && laptopBrandChoice === BRAND_OTHER_VALUE && !laptopBrandOther.trim()) {
      setError("Enter a custom company name or choose a listed brand.");
      return;
    }

    const companyNorm = formatCompanyDisplayName(companyRaw);
    setSaving(true);
    const url = existing ? `/api/assets/${existing.id}` : "/api/assets";
    const body: Record<string, unknown> = {
      asset_id: existing ? existing.asset_id : null,
      name: companyNorm,
      category,
      serial: serial || null,
      imei_1: imei1.trim() || null,
      imei_2: imei2.trim() || null,
      model: modelRaw || null,
      specs: buildSpecs(companyNorm, specRam),
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
  const assetIdPlaceholder = existing ? "—" : previewLoading ? "Calculating…" : "Select asset type and company";

  const showStructuredBrands = isMobile || isLaptop;
  const showGenericCompanyModel = !showStructuredBrands && !!effectiveCategory;

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
            : "Assigned on save from the next number in sequence. Laptop/Mobile use short brand codes; other types use a fixed prefix."}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Serial number</label>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          className={inputClass}
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
                className={`${inputClass} font-mono`}
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
                className={`${inputClass} font-mono`}
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
        <select
          value={assetTypeChoice}
          onChange={(e) => onAssetTypeSelectChange(e.target.value)}
          required={!existing}
          className={selectClass}
        >
          {!existing ? <option value="">Select asset type…</option> : null}
          {ASSET_TYPE_PRESETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={ASSET_TYPE_OTHER_VALUE}>Other (custom type)</option>
        </select>
        {assetTypeChoice === ASSET_TYPE_OTHER_VALUE ? (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Custom asset type</label>
            <input
              value={assetTypeOther}
              onChange={(e) => setAssetTypeOther(e.target.value)}
              className={inputClass}
              placeholder="e.g. Charger, custom hardware…"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">Saved as the category; used for grouping and ID rules when configured.</p>
          </div>
        ) : null}
      </div>

      {!existing && !effectiveCategory ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Select an asset type to enter company and model.
        </p>
      ) : null}

      {isMobile ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Company</label>
            <select
              value={mobileBrandChoice}
              onChange={(e) => onMobileBrandSelectChange(e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Select company…</option>
              {MOBILE_COMPANY_PRESETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={BRAND_OTHER_VALUE}>Other (custom company)</option>
            </select>
            {mobileBrandChoice === BRAND_OTHER_VALUE ? (
              <input
                value={mobileBrandOther}
                onChange={(e) => setMobileBrandOther(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Custom company / brand"
                required
              />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">RAM (if applicable)</label>
              <input
                value={specRam}
                onChange={(e) => setSpecRam(e.target.value)}
                className={inputClass}
                placeholder="e.g. 16GB"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Model</label>
            {!mobileCompanyEffective ? (
              <p className="text-sm text-zinc-500">Select a company to see models.</p>
            ) : (
              <>
                <select
                  value={mobileModelChoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMobileModelChoice(v);
                    if (v !== MODEL_OTHER_VALUE) setMobileModelOther("");
                  }}
                  required
                  className={selectClass}
                >
                  <option value="">Select model…</option>
                  {mobileModelsList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={MODEL_OTHER_VALUE}>Other (custom model)</option>
                </select>
                {mobileModelChoice === MODEL_OTHER_VALUE ? (
                  <input
                    value={mobileModelOther}
                    onChange={(e) => setMobileModelOther(e.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="Custom model name"
                    required
                  />
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}

      {isLaptop ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Company</label>
            <select
              value={laptopBrandChoice}
              onChange={(e) => onLaptopBrandSelectChange(e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Select company…</option>
              {LAPTOP_COMPANY_PRESETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={BRAND_OTHER_VALUE}>Other (custom company)</option>
            </select>
            {laptopBrandChoice === BRAND_OTHER_VALUE ? (
              <input
                value={laptopBrandOther}
                onChange={(e) => setLaptopBrandOther(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Custom company / brand"
                required
              />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">RAM (if applicable)</label>
              <input
                value={specRam}
                onChange={(e) => setSpecRam(e.target.value)}
                className={inputClass}
                placeholder="e.g. 16GB"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
              placeholder="Enter model (dropdown by company can be added later)"
            />
            <p className="mt-1 text-xs text-zinc-500">Laptop models are free text for now; list will follow mobile-style rules later.</p>
          </div>
        </>
      ) : null}

      {showGenericCompanyModel ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Company / brand</label>
              <input
                value={specCompany}
                onChange={(e) => setSpecCompany(e.target.value)}
                required
                className={inputClass}
                placeholder="e.g. manufacturer or brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">RAM (if applicable)</label>
              <input
                value={specRam}
                onChange={(e) => setSpecRam(e.target.value)}
                className={inputClass}
                placeholder="e.g. 16GB"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
              placeholder="Model, SKU, or part number"
            />
            <p className="mt-1 text-xs text-zinc-500">Optional. Specific model for this item.</p>
          </div>
        </>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Condition</label>
        <input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className={inputClass}
          placeholder="e.g. Good, Fair"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Software connectivity</label>
        <input
          value={softwareConnectivity}
          onChange={(e) => setSoftwareConnectivity(e.target.value)}
          className={inputClass}
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
