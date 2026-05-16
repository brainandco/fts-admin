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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = normalizeHierarchyName(String(body.name), 120);
    if (!name) return NextResponse.json({ message: "Invalid name" }, { status: 400 });
    patch.name = name;
  }
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  const supabase = await getDataClient();
  const { data, error } = await supabase
    .from("pp_report_accounts")
    .update(patch)
    .eq("id", id)
    .select("id, name, sort_order, is_active")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "An account with this name already exists." : error.message;
    return NextResponse.json({ message: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await getDataClient();
  const { error } = await supabase.from("pp_report_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
