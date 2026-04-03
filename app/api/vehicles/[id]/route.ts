import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

const VEHICLE_KEYS = [
  "plate_number", "vehicle_type", "rent_company", "make", "model", "assignment_type", "status",
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerSupabaseClient();
  const { data: old } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (body.unassign === true) {
    return NextResponse.json(
      { message: "Direct employee vehicle assignment management is PM-only. Use Project Manager workflow." },
      { status: 403 }
    );
  }

  if (body.employee_id != null && body.employee_id !== "") {
    return NextResponse.json(
      { message: "Direct employee vehicle assignment is PM-only. Use Project Manager workflow." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {};
  VEHICLE_KEYS.forEach((k) => {
    if (body[k] !== undefined) updates[k] = body[k] === "" ? null : body[k];
  });
  if (updates.plate_number !== undefined && typeof updates.plate_number === "string" && !String(updates.plate_number).trim()) {
    return NextResponse.json({ message: "Vehicle plate number is required" }, { status: 400 });
  }
  if (updates.assignment_type !== undefined && !["Temporary", "Permanent"].includes(String(updates.assignment_type))) {
    return NextResponse.json({ message: "assignment_type must be Temporary or Permanent" }, { status: 400 });
  }
  const { error } = await supabase.from("vehicles").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "update", entityType: "vehicle", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Vehicle updated" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!vehicle) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "delete", entityType: "vehicle", entityId: id, oldValue: vehicle, description: "Vehicle deleted" });
  return NextResponse.json({ ok: true });
}
