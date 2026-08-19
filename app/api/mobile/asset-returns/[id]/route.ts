import { NextResponse } from "next/server";
import { processAssetReturnRequest, type ReturnDisposition } from "@/lib/assets/processReturnRequest";
import { employeeHasPmRole } from "@/lib/employees/pm-role";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** GET — single PM asset return for Admin Lite mobile. */
export async function GET(req: Request, { params }: Params) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("assets.manage") || ctx.permissions.has("assets.return"))) {
    return NextResponse.json({ message: "You do not have access to asset returns." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: row } = await supabase
    .from("asset_return_requests")
    .select("id, asset_id, from_employee_id, employee_comment, return_image_urls, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ message: "Already processed" }, { status: 409 });

  const returnerIsPm = await employeeHasPmRole(supabase, row.from_employee_id);
  if (!returnerIsPm) {
    return NextResponse.json({ message: "This return is handled by the Project Manager in the Employee Portal." }, { status: 403 });
  }

  const [{ data: asset }, { data: employee }] = await Promise.all([
    supabase.from("assets").select("id, name, model, serial, category, status").eq("id", row.asset_id).maybeSingle(),
    supabase.from("employees").select("id, full_name, email").eq("id", row.from_employee_id).maybeSingle(),
  ]);

  return NextResponse.json({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    employeeComment: row.employee_comment ?? null,
    returnImageUrls: Array.isArray(row.return_image_urls) ? row.return_image_urls : [],
    fromEmployeeName: employee?.full_name ?? null,
    fromEmployeeEmail: employee?.email ?? null,
    asset: asset
      ? {
          id: asset.id,
          name: asset.name ?? null,
          model: asset.model ?? null,
          serial: asset.serial ?? null,
          category: asset.category ?? null,
          status: asset.status ?? null,
        }
      : null,
    canProcess: true,
  });
}

/** POST — process PM asset return from Admin Lite mobile. */
export async function POST(req: Request, { params }: Params) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("assets.manage") || ctx.permissions.has("assets.return"))) {
    return NextResponse.json({ message: "You do not have access to asset returns." }, { status: 403 });
  }

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
      { message: "Regular employee returns are confirmed by the Project Manager in the Employee Portal." },
      { status: 403 }
    );
  }

  if (decision !== "Available" && !String(pm_comment ?? "").trim()) {
    return NextResponse.json({ message: "Add a comment explaining maintenance or damage." }, { status: 400 });
  }

  const result = await processAssetReturnRequest(supabase, id, ctx.userId, decision, pm_comment);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
