/** Preset asset types for “Add tool” (dropdown). Custom types use Other + text. */
export const ASSET_TYPE_PRESETS = [
  "Mobile",
  "Laptop",
  "GPS",
  "Inverter",
  "Data Cable",
  "USB Hub",
  "Scanner",
  "Spectrum",
] as const;

export type AssetTypePreset = (typeof ASSET_TYPE_PRESETS)[number];

export const ASSET_TYPE_OTHER_VALUE = "__other__";

export function isPresetAssetType(category: string): boolean {
  const c = category.trim().toLowerCase();
  return (ASSET_TYPE_PRESETS as readonly string[]).some((p) => p.toLowerCase() === c);
}

export function matchPresetCategory(category: string): AssetTypePreset | null {
  const c = category.trim().toLowerCase();
  for (const p of ASSET_TYPE_PRESETS) {
    if (p.toLowerCase() === c) return p;
  }
  return null;
}

export const MOBILE_COMPANY_PRESETS = ["Huawei", "Samsung", "iPhone", "Sony"] as const;

export const LAPTOP_COMPANY_PRESETS = ["Lenovo", "HP", "Asus", "Acer", "Dell", "Huawei"] as const;

export const BRAND_OTHER_VALUE = "__other__";

export const MODEL_OTHER_VALUE = "__other__";

/** Mobile models by company (exact labels for dropdown). */
export const MOBILE_MODELS_BY_COMPANY: Record<string, string[]> = {
  Huawei: [
    "Huawei P40",
    "Huawei P40 Pro",
    "Huawei Mate 20 Pro",
    "Huawei Mate 40 Pro",
    "Huawei P20",
    "Huawei P10",
    "Huawei P30 Pro",
    "Huawei P30",
  ],
  Samsung: [
    "Samsung S20",
    "Samsung S21",
    "Samsung S22",
    "Samsung S23",
    "Samsung S24",
    "Samsung S23 Plus",
    "Samsung S23 Ultra",
    "Samsung S25",
    "Samsung S5",
  ],
  Sony: ["Sony Ericson W995"],
  iPhone: [
    "iPhone 11",
    "iPhone 11 Pro",
    "iPhone 11 Pro Max",
    "iPhone 12",
    "iPhone 12 Pro",
    "iPhone 12 Pro Max",
    "iPhone 13",
    "iPhone 13 Pro",
    "iPhone 13 Pro Max",
    "iPhone 14",
    "iPhone 14 Pro",
    "iPhone 14 Pro Max",
    "iPhone 15",
    "iPhone 15 Pro",
    "iPhone 15 Pro Max",
    "iPhone 16",
    "iPhone 16 Pro",
    "iPhone 16 Pro Max",
    "iPhone 17",
    "iPhone 17 Pro",
    "iPhone 17 Pro Max",
    "iPhone 18",
    "iPhone 18 Pro",
    "iPhone 18 Pro Max",
  ],
};

export function mobileModelsForCompany(company: string): string[] {
  const key = company.trim();
  if (!key) return [];
  const direct = MOBILE_MODELS_BY_COMPANY[key];
  if (direct) return direct;
  const found = Object.keys(MOBILE_MODELS_BY_COMPANY).find((k) => k.toLowerCase() === key.toLowerCase());
  return found ? MOBILE_MODELS_BY_COMPANY[found]! : [];
}

export function isMobileCategory(category: string): boolean {
  return category.trim().toLowerCase() === "mobile";
}

export function isLaptopCategory(category: string): boolean {
  return category.trim().toLowerCase() === "laptop";
}
