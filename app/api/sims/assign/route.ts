import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (await can("assets.manage")) {
    return NextResponse.json(
      { message: "Direct employee SIM assignment is PM-only. Use Project Manager workflow." },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const simIds = Array.isArray(body.sim_ids) ? body.sim_ids.filter((v: unknown) => typeof v === "string") : [];
  const employeeId = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  if (!employeeId || simIds.length === 0) {
    return NextResponse.json({ message: "sim_ids and employee_id required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  const now = new Date().toISOString();

  const { data: sims } = await supabase.from("sim_cards").select("id, status").in("id", simIds).eq("status", "Available");
  const availableIds = (sims ?? []).map((s) => s.id);
  const skipped = simIds.length - availableIds.length;

  for (const id of availableIds) {
    const updates = {
      status: "Assigned",
      assigned_to_employee_id: employeeId,
      assigned_by_user_id: user?.id ?? null,
      assigned_at: now,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    };
    await supabase.from("sim_cards").update(updates).eq("id", id);
    await supabase.from("sim_assignment_history").insert({
      sim_card_id: id,
      to_employee_id: employeeId,
      assigned_by_user_id: user?.id ?? null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    });
    await auditLog({
      actionType: "update",
      entityType: "sim_card",
      entityId: id,
      newValue: updates,
      description: "SIM card assigned",
    });
  }

  return NextResponse.json({
    assigned: availableIds.length,
    skipped,
    message: skipped > 0
      ? `Assigned ${availableIds.length} SIM(s). ${skipped} were not Available and skipped.`
      : `Assigned ${availableIds.length} SIM(s).`,
  });
}
