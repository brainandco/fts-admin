import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { processAssetReturnRequest, type ReturnDisposition } from "@/lib/assets/processReturnRequest";
import { employeeHasPmRole } from "@/lib/employees/pm-role";

/** Admin confirms asset returns from Project Managers (no GM step required). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage")) && !(await can("assets.return"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision as ReturnDisposition | undefined;
  const pm_comment = typeof body.pm_comment === "string" ? body.pm_comment : null;

  const allowed: ReturnDisposition[] = ["Available", "Under_Maintenance", "Damaged"];
  if (!decision || !allowed.includes(decision)) {
    return NextResponse.json(
      { message: "decision must be Available, Under_Maintenance, or Damaged" },
      { status: 400 }
    );
  }

  const supabase = await getDataClient();
  const { data: row } = await supabase
    .from("asset_return_requests")
    .select("id, from_employee_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ message: "Already processed" }, { status: 400 });

  const returnerIsPm = await employeeHasPmRole(supabase, row.from_employee_id);
  if (!returnerIsPm) {
    return NextResponse.json(
      {
        message:
          "Regular employee returns are confirmed by the Project Manager in the Employee Portal. Admin confirms returns from Project Managers only.",
      },
      { status: 403 }
    );
  }

  const result = await processAssetReturnRequest(supabase, id, user.id, decision, pm_comment);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
