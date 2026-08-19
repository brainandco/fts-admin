import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** GET — single profile update request (Admin Lite mobile). */
export async function GET(req: Request, { params }: Params) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("employees.manage"))) {
    return NextResponse.json({ message: "You do not have access to profile update requests." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: row } = await supabase
    .from("employee_profile_update_requests")
    .select(
      "id, employee_id, status, requested_full_name, requested_phone, requested_email, note_from_employee, created_at, resolved_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name, phone, email")
    .eq("id", row.employee_id)
    .maybeSingle();

  return NextResponse.json({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? null,
    noteFromEmployee: row.note_from_employee ?? null,
    canAct: row.status === "pending",
    current: {
      fullName: emp?.full_name ?? null,
      phone: emp?.phone ?? null,
      email: emp?.email ?? null,
    },
    requested: {
      fullName: row.requested_full_name ?? null,
      phone: row.requested_phone ?? null,
      email: row.requested_email ?? null,
    },
    employeeId: row.employee_id,
    employeeName: emp?.full_name ?? null,
  });
}

/** PATCH — mark profile update completed or dismissed (Admin Lite mobile). */
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("employees.manage"))) {
    return NextResponse.json({ message: "You do not have access to profile update requests." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status === "completed" || body.status === "dismissed" ? body.status : null;
  if (!status) {
    return NextResponse.json({ message: "status must be completed or dismissed" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: row } = await supabase
    .from("employee_profile_update_requests")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ message: "This request is no longer pending." }, { status: 400 });
  }

  const { error } = await supabase
    .from("employee_profile_update_requests")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: ctx.userId,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
