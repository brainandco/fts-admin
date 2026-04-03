import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

/** Create one asset (Available). Assignment to employees is done on Assign to employee page. */
export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, category } = body;
  if (!name || !category) return NextResponse.json({ message: "name, category required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();

  const insert: Record<string, unknown> = {
    asset_id: body.asset_id || null,
    name: String(name).trim(),
    category: String(category).trim(),
    serial: body.serial?.trim() || null,
    imei_1: typeof body.imei_1 === "string" ? body.imei_1.trim() || null : null,
    imei_2: typeof body.imei_2 === "string" ? body.imei_2.trim() || null : null,
    model: typeof body.model === "string" ? body.model.trim() || null : null,
    purchase_date: body.purchase_date || null,
    warranty_end: body.warranty_end || null,
    condition: body.condition || null,
    software_connectivity: typeof body.software_connectivity === "string" ? body.software_connectivity.trim() || null : null,
    status: "Available",
    specs: body.specs && typeof body.specs === "object" ? body.specs : {},
  };

  const { data, error } = await supabase.from("assets").insert(insert).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "asset", entityId: data.id, newValue: insert, description: "Asset created" });
  return NextResponse.json({ id: data.id });
}
