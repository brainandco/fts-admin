import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await getDataClient();
  const { data: old } = await supabase.from("sim_cards").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const k of ["operator", "service_type", "sim_number", "phone_number", "notes"] as const) {
    if (body[k] !== undefined) {
      updates[k] = typeof body[k] === "string" ? body[k].trim() || null : body[k];
    }
  }
  if (updates.service_type) {
    const allowed = new Set(["Data", "Voice", "Data+Voice"]);
    if (!allowed.has(String(updates.service_type))) {
      return NextResponse.json({ message: "service_type must be Data, Voice, or Data+Voice" }, { status: 400 });
    }
  }

  if (body.unassign === true) {
    return NextResponse.json(
      { message: "Direct employee SIM assignment management is PM-only. Use Project Manager workflow." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("sim_cards").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "update", entityType: "sim_card", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "SIM card updated" });
  return NextResponse.json({ ok: true });
}
