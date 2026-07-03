import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { computeNextEhsAssetId } from "@/lib/assets/ehs-id-scheme";
import type { EhsWearRole } from "@/lib/assets/ehs-tool-catalog";

export async function GET(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const toolType = url.searchParams.get("ehs_tool_type")?.trim() ?? "";
  const wearRole = url.searchParams.get("ehs_wear_role")?.trim() ?? "";
  if (!toolType || (wearRole !== "dt" && wearRole !== "driver_rigger")) {
    return NextResponse.json({ message: "ehs_tool_type and ehs_wear_role (dt|driver_rigger) required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const nextId = await computeNextEhsAssetId(supabase, toolType, wearRole as EhsWearRole);
  if (!nextId) return NextResponse.json({ message: "Could not compute next ID" }, { status: 400 });
  return NextResponse.json({ asset_id: nextId });
}
