import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";
import { assetIdentifierConflictMessage } from "@/lib/data-uniqueness";
import { ehsCategoryLabel, ehsDisplayName, getEhsToolType } from "@/lib/assets/ehs-tool-catalog";
import { computeNextEhsAssetId } from "@/lib/assets/ehs-id-scheme";

/** Create one EHS tool (Available, global pool). Wear role is set at assignment. */
export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const toolTypeKey = typeof body.ehs_tool_type === "string" ? body.ehs_tool_type.trim() : "";
  const def = getEhsToolType(toolTypeKey);
  if (!def) return NextResponse.json({ message: "Invalid EHS tool type" }, { status: 400 });

  const purchaseUrls = parseImageUrlArray(body.purchase_image_urls);
  const supabase = await createServerSupabaseClient();
  const dataClient = await getDataClient();

  const resolvedAssetId = await computeNextEhsAssetId(dataClient, toolTypeKey);
  if (!resolvedAssetId) {
    return NextResponse.json({ message: "Could not generate EHS asset ID." }, { status: 400 });
  }

  const category = ehsCategoryLabel(def);
  const name = ehsDisplayName(def);
  const condition = typeof body.condition === "string" ? body.condition.trim() || null : null;

  const insert: Record<string, unknown> = {
    asset_id: resolvedAssetId,
    name,
    category,
    condition,
    status: "Available",
    specs: {},
    purchase_image_urls: purchaseUrls,
    is_ehs_tool: true,
    ehs_wear_role: null,
    ehs_tool_type: def.key,
    en_code: def.enCode,
  };

  const idConflict = await assetIdentifierConflictMessage(dataClient, {
    asset_id: insert.asset_id as string,
  });
  if (idConflict) return NextResponse.json({ message: idConflict }, { status: 400 });

  const { data, error } = await supabase.from("assets").insert(insert).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({
    actionType: "create",
    entityType: "asset",
    entityId: data.id,
    newValue: insert,
    description: "EHS tool created",
  });

  return NextResponse.json({ id: data.id, asset_id: resolvedAssetId });
}

/** List EHS tools. */
export async function GET(req: Request) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const dataClient = await getDataClient();

  let q = dataClient
    .from("assets")
    .select(
      "id, asset_id, name, category, condition, status, assigned_to_employee_id, ehs_wear_role, ehs_tool_type, en_code, ehs_for_employee_id, created_at"
    )
    .eq("is_ehs_tool", true)
    .order("asset_id");

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}
