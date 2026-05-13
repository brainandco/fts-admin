import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("employees.manage"))) {
    return NextResponse.json({ message: "You do not have permission to update these requests." }, { status: 403 });
  }

  const { id } = await params;
  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
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

  const { profile } = await getCurrentUserProfile();
  const { error } = await supabase
    .from("employee_profile_update_requests")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: profile?.id ?? null,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
