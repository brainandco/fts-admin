import { NextResponse } from "next/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { fetchPpReportHierarchyAdmin } from "@/lib/pp-reports/folder-hierarchy";
import { getDataClient } from "@/lib/supabase/server";

async function gate() {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return { ok: false as const };
  }
  return { ok: true as const };
}

/** GET — all operators, accounts, projects (including inactive). */
export async function GET() {
  const g = await gate();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  try {
    const supabase = await getDataClient();
    const hierarchy = await fetchPpReportHierarchyAdmin(supabase, true);
    return NextResponse.json(hierarchy);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
