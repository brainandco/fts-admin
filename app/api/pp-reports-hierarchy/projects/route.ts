import { NextResponse } from "next/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { normalizeHierarchyName } from "@/lib/pp-reports/folder-hierarchy";
import { getDataClient } from "@/lib/supabase/server";

async function gate() {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return { ok: false as const };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = normalizeHierarchyName(String(body.name ?? ""), 200);
  const operator_id = String(body.operator_id ?? "").trim();
  if (!name) return NextResponse.json({ message: "Name is required (max 200 characters)." }, { status: 400 });
  if (!operator_id) return NextResponse.json({ message: "operator_id is required." }, { status: 400 });

  const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
  const is_active = body.is_active !== false;

  const supabase = await getDataClient();
  const { data, error } = await supabase
    .from("pp_report_projects")
    .insert({ name, operator_id, sort_order, is_active })
    .select("id, name, sort_order, is_active, operator_id")
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "This project already exists for the selected operator."
        : error.code === "23503"
          ? "Invalid operator."
          : error.message;
    return NextResponse.json({ message: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}
