import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { buildInventoryOverview } from "@/lib/mobile/inventory-overview";
import { getDataClient } from "@/lib/supabase/server";

/** GET — region/project inventory counts for Admin Lite mobile. */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const canView =
    ctx.isSuper ||
    ctx.permissions.has("assets.manage") ||
    ctx.permissions.has("assets.assign") ||
    ctx.permissions.has("vehicles.manage") ||
    ctx.permissions.has("vehicles.assign");
  if (!canView) {
    return NextResponse.json({ message: "You do not have access to inventory." }, { status: 403 });
  }

  const supabase = await getDataClient();
  const overview = await buildInventoryOverview(ctx, supabase);
  return NextResponse.json(overview);
}
