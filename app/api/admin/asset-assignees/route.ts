import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { buildGlobalAssetAssignees } from "@/lib/admin-assignment/team-region-lists";
import { NextResponse } from "next/server";

/** All employees eligible for asset assignment (any region); used when UI does not pick a region first. */
export async function GET() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const supabase = await getDataClient();
  const employees = await buildGlobalAssetAssignees(supabase);
  return NextResponse.json({ employees });
}
