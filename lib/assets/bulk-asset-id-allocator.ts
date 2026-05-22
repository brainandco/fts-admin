import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allocationKeyForAssetId,
  companyAbbrevForAssetId,
  formatNextAssetId,
  nextAssetIdNumberAfterExisting,
  resolveAssetIdScheme,
} from "@/lib/assets/asset-id-scheme";

/**
 * Assigns sequential asset_id values during CSV import: continues from the highest
 * existing ID per asset type (and per company for laptops/mobiles), including rows
 * already assigned earlier in the same import batch.
 */
export class BulkAssetIdAllocator {
  private readonly ids: (string | null)[];
  private readonly nextByKey = new Map<string, number>();

  constructor(existingAssetIds: (string | null)[]) {
    this.ids = [...existingAssetIds];
  }

  allocateNext(category: string, company: string): string | null {
    const scheme = resolveAssetIdScheme(category);
    if (!scheme) return null;
    if (scheme.kind === "company_middle" && !companyAbbrevForAssetId(company)) return null;

    const key = allocationKeyForAssetId(scheme, company);
    let num = this.nextByKey.get(key);
    if (num === undefined) {
      num = nextAssetIdNumberAfterExisting(scheme, company, this.ids);
    }
    const assetId = formatNextAssetId(scheme, company, num);
    this.nextByKey.set(key, num + 1);
    this.ids.push(assetId);
    return assetId;
  }
}

export async function createBulkAssetIdAllocator(supabase: SupabaseClient): Promise<BulkAssetIdAllocator> {
  const { data, error } = await supabase.from("assets").select("asset_id");
  if (error) throw new Error(error.message);
  return new BulkAssetIdAllocator((data ?? []).map((r) => r.asset_id as string | null));
}

/** Use CSV asset_id when provided; otherwise generate from type + company. */
export function resolveImportAssetId(
  allocator: BulkAssetIdAllocator,
  category: string,
  company: string,
  csvAssetId: string | null | undefined
): string | null {
  const trimmed = typeof csvAssetId === "string" ? csvAssetId.trim() : "";
  if (trimmed) return trimmed;
  return allocator.allocateNext(category, company);
}
