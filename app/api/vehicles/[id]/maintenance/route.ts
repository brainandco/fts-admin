import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("vehicles.maintenance_manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id: vehicleId } = await params;
  const body = await req.json();
  const { service_date } = body;
  if (!service_date) return NextResponse.json({ message: "service_date required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("vehicle_maintenance").insert({
    vehicle_id: vehicleId,
    service_date: body.service_date,
    service_type: body.service_type || null,
    mileage_at_service: body.mileage_at_service != null ? Number(body.mileage_at_service) : null,
    cost: body.cost != null ? Number(body.cost) : null,
    notes: body.notes || null,
    vendor: body.vendor || null,
    created_by: user?.id,
  }).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "vehicle_maintenance", entityId: data.id, newValue: body, description: "Maintenance log added", meta: { vehicle_id: vehicleId } });
  return NextResponse.json(data);
}
