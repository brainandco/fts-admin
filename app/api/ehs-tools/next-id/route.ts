import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { computeNextEhsAssetId } from "@/lib/assets/ehs-id-scheme";

export async function GET(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const toolType = url.searchParams.get("ehs_tool_type")?.trim() ?? "";
  if (!toolType) {
    return NextResponse.json({ message: "ehs_tool_type required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const nextId = await computeNextEhsAssetId(supabase, toolType);
  if (!nextId) return NextResponse.json({ message: "Could not compute next ID" }, { status: 400 });
  return NextResponse.json({ asset_id: nextId });
}
