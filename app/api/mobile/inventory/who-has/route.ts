import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { buildWhoHasAssets } from "@/lib/mobile/inventory-overview";
import { getDataClient } from "@/lib/supabase/server";

/** GET — who currently holds assigned assets (Admin Lite). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const canView =
    ctx.isSuper || ctx.permissions.has("assets.manage") || ctx.permissions.has("assets.assign");
  if (!canView) {
    return NextResponse.json({ message: "You do not have access to asset assignments." }, { status: 403 });
  }

  const url = new URL(req.url);
  const regionId = url.searchParams.get("regionId");
  const projectId = url.searchParams.get("projectId");
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "80", 10);

  const supabase = await getDataClient();
  const data = await buildWhoHasAssets(ctx, supabase, {
    regionId: regionId || null,
    projectId: projectId || null,
    limit: Number.isFinite(rawLimit) ? rawLimit : 80,
  });
  return NextResponse.json(data);
}
