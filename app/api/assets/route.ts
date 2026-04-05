import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { hasMinimumPhotos, MIN_RESOURCE_PHOTOS, parseImageUrlArray } from "@/lib/assets/resource-photos";

/** Create one asset (Available). Assignment to employees is done on Assign to employee page. */
export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { category } = body;
  const specsRaw = body.specs && typeof body.specs === "object" && !Array.isArray(body.specs) ? (body.specs as Record<string, unknown>) : {};
  const company =
    typeof specsRaw.company === "string" ? specsRaw.company.trim() : typeof body.name === "string" ? body.name.trim() : "";
  if (!category || !company) {
    return NextResponse.json({ message: "category and company (company / brand) required" }, { status: 400 });
  }
  const name = company;
  const purchaseUrls = parseImageUrlArray(body.purchase_image_urls);
  if (!hasMinimumPhotos(purchaseUrls)) {
    return NextResponse.json(
      { message: `Add at least ${MIN_RESOURCE_PHOTOS} condition photos (purchase / intake) before saving.` },
      { status: 400 }
    );
  }
  const supabase = await createServerSupabaseClient();

  const insert: Record<string, unknown> = {
    asset_id: body.asset_id || null,
    name: String(name).trim(),
    category: String(category).trim(),
    serial: body.serial?.trim() || null,
    imei_1: typeof body.imei_1 === "string" ? body.imei_1.trim() || null : null,
    imei_2: typeof body.imei_2 === "string" ? body.imei_2.trim() || null : null,
    model: typeof body.model === "string" ? body.model.trim() || null : null,
    condition: body.condition || null,
    software_connectivity: typeof body.software_connectivity === "string" ? body.software_connectivity.trim() || null : null,
    status: "Available",
    specs: body.specs && typeof body.specs === "object" ? body.specs : {},
    purchase_image_urls: purchaseUrls,
  };

  const { data, error } = await supabase.from("assets").insert(insert).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "asset", entityId: data.id, newValue: insert, description: "Asset created" });
  return NextResponse.json({ id: data.id });
}
