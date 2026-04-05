import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { buildRegionFlatAssignees } from "@/lib/admin-assignment/team-region-lists";

const VARIANTS = new Set(["asset", "vehicle", "sim"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regionId = (searchParams.get("region_id") ?? "").trim();
  const variant = (searchParams.get("variant") ?? "asset").trim() as "asset" | "vehicle" | "sim";
  if (!regionId) {
    return NextResponse.json({ message: "region_id required" }, { status: 400 });
  }
  if (!VARIANTS.has(variant)) {
    return NextResponse.json({ message: "variant must be asset, vehicle, or sim" }, { status: 400 });
  }
  if (variant === "vehicle") {
    if (!(await can("vehicles.manage")) && !(await can("vehicles.assign"))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  } else if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await getDataClient();
  const employees = await buildRegionFlatAssignees(supabase, regionId, variant);
  return NextResponse.json({ employees });
}
