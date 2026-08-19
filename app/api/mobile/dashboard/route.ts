import { NextResponse } from "next/server";
import { buildAdminMobileDashboard } from "@/lib/mobile/admin-dashboard";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** GET — Admin Lite mobile dashboard summary (queue counts + access flags). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = await getDataClient();
  const dashboard = await buildAdminMobileDashboard(ctx, supabase);
  return NextResponse.json(dashboard);
}
