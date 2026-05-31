import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";

export async function GET() {
  if (!(await can("audit_logs.view_all"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await getDataClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [recentRes, adminRes, employeeRes, fileRes] = await Promise.all([
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("timestamp", since24h),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("portal", "admin").gte("timestamp", since24h),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("portal", "employee").gte("timestamp", since24h),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action_category", "file")
      .gte("timestamp", since24h),
  ]);

  const { data: categoryRows } = await supabase
    .from("audit_logs")
    .select("action_category")
    .gte("timestamp", since24h)
    .limit(5000);

  const byCategory: Record<string, number> = {};
  for (const row of categoryRows ?? []) {
    const c = (row.action_category as string) || "other";
    byCategory[c] = (byCategory[c] ?? 0) + 1;
  }

  return NextResponse.json({
    last24h: recentRes.count ?? 0,
    admin24h: adminRes.count ?? 0,
    employee24h: employeeRes.count ?? 0,
    fileActions24h: fileRes.count ?? 0,
    byCategory,
  });
}
