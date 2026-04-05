import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { hasMinimumPhotos, MIN_RESOURCE_PHOTOS, parseImageUrlArray } from "@/lib/assets/resource-photos";

export async function GET() {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  const { data: vehicles } = await supabase.from("vehicles").select("id, plate_number").order("plate_number");
  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  const { data: assignments } = vehicleIds.length
    ? await supabase.from("vehicle_assignments").select("vehicle_id, employee_id").in("vehicle_id", vehicleIds)
    : { data: [] };
  const employeeIds = [...new Set((assignments ?? []).map((a) => a.employee_id))];
  const { data: employees } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
    : { data: [] };
  const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
  const assignByVehicle = new Map((assignments ?? []).map((a) => [a.vehicle_id, a]));
  const list = (vehicles ?? []).map((v) => ({
    id: v.id,
    plate_number: v.plate_number,
    name: assignByVehicle.has(v.id) ? (empMap.get(assignByVehicle.get(v.id)!.employee_id) ?? null) : null,
  }));
  return NextResponse.json({ vehicles: list });
}

export async function POST(req: Request) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const plate_number = typeof body.plate_number === "string" ? body.plate_number.trim() : "";
  if (!plate_number) return NextResponse.json({ message: "Vehicle plate number is required" }, { status: 400 });
  const purchaseUrls = parseImageUrlArray(body.purchase_image_urls);
  if (!hasMinimumPhotos(purchaseUrls)) {
    return NextResponse.json(
      { message: `Add at least ${MIN_RESOURCE_PHOTOS} condition photos before saving the vehicle.` },
      { status: 400 }
    );
  }
  const supabase = await createServerSupabaseClient();
  const assignment_type =
    body.assignment_type === "Temporary" || body.assignment_type === "Permanent"
      ? body.assignment_type
      : "Permanent";
  const insert = {
    plate_number,
    vehicle_type: body.vehicle_type || null,
    rent_company: body.rent_company || null,
    make: body.make || null,
    model: body.model || null,
    assignment_type,
    status: body.status || "Available",
    purchase_image_urls: purchaseUrls,
  };
  const { data, error } = await supabase.from("vehicles").insert(insert).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "vehicle", entityId: data.id, newValue: insert, description: "Vehicle created" });
  return NextResponse.json(data);
}
