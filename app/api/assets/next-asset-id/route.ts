import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { computeNextAssetId, resolveAssetIdScheme } from "@/lib/assets/asset-id-scheme";

/** Preview next auto asset_id for the add-asset form (category + company). */
export async function GET(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category")?.trim() ?? "";
  const company = searchParams.get("company")?.trim() ?? "";

  if (!category) {
    return NextResponse.json({ asset_id: null as string | null, reason: "missing_category" });
  }

  const scheme = resolveAssetIdScheme(category);
  if (!scheme) {
    return NextResponse.json({ asset_id: null as string | null, reason: "unknown_category" });
  }

  if (scheme.kind === "company_middle" && !company) {
    return NextResponse.json({ asset_id: null as string | null, reason: "missing_company" });
  }

  const supabase = await getDataClient();
  const asset_id = await computeNextAssetId(supabase, category, company);
  return NextResponse.json({ asset_id });
}
