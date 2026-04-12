import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { computeNextTeamCodeForRegion } from "@/lib/teams/autoTeamCode";

/**
 * GET /api/teams/next-code?region_id=uuid
 * Suggested TEAM-{REGION_SLUG}-NN name/code for new teams (same value for both).
 */
export async function GET(req: Request) {
  if (!(await can("teams.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const regionId = searchParams.get("region_id")?.trim();
  if (!regionId) {
    return NextResponse.json({ message: "region_id is required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: regionRow } = await supabase.from("regions").select("id, name").eq("id", regionId).maybeSingle();
  const fromQuery = searchParams.get("region_name")?.trim();
  const regionName = regionRow?.name?.trim() || fromQuery;
  if (!regionName) {
    return NextResponse.json({ message: "Region not found" }, { status: 404 });
  }

  const { code, slug, sequence } = await computeNextTeamCodeForRegion(supabase, regionId, regionName);

  return NextResponse.json({
    code,
    name: code,
    region_name: regionName,
    slug,
    sequence,
  });
}
