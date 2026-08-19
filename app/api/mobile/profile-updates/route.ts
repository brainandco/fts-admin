import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** GET — pending profile update requests (Admin Lite mobile). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("employees.manage"))) {
    return NextResponse.json({ message: "You do not have access to profile update requests." }, { status: 403 });
  }

  const supabase = await getDataClient();
  const { data: rows, error } = await supabase
    .from("employee_profile_update_requests")
    .select(
      "id, employee_id, status, requested_full_name, requested_phone, requested_email, note_from_employee, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const empIds = [...new Set((rows ?? []).map((r) => r.employee_id))];
  const { data: emps } = empIds.length
    ? await supabase.from("employees").select("id, full_name, phone, email").in("id", empIds)
    : { data: [] };
  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));

  const items = (rows ?? []).map((r) => {
    const emp = empMap.get(r.employee_id);
    const preview = [
      r.requested_full_name && `Name → ${r.requested_full_name}`,
      r.requested_phone && `Phone → ${r.requested_phone}`,
      r.requested_email && `Email → ${r.requested_email}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      employeeName: emp?.full_name ?? null,
      employeeEmail: emp?.email ?? null,
      requestedPreview: preview || "Profile update",
      noteFromEmployee: r.note_from_employee ?? null,
    };
  });

  return NextResponse.json({ items, pendingCount: items.length });
}
