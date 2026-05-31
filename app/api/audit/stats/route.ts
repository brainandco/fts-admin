import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";

export async function GET() {
  if (!(await can("audit_logs.view_all"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await getDataClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [recentRes, adminRes, employeeRes] = await Promise.all([
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("timestamp", since24h),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .or("portal.eq.admin,portal.is.null")
      .gte("timestamp", since24h),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("portal", "employee").gte("timestamp", since24h),
  ]);

  let fileActions24h = 0;
  const fileRes = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action_category", "file")
    .gte("timestamp", since24h);

  if (!fileRes.error) {
    fileActions24h = fileRes.count ?? 0;
  } else {
    const fallback = await supabase
      .from("audit_logs")
      .select("action_type", { count: "exact", head: false })
      .gte("timestamp", since24h)
      .limit(5000);
    fileActions24h = (fallback.data ?? []).filter((r) => {
      const a = String((r as { action_type?: string }).action_type ?? "").toLowerCase();
      return a.includes("file") || a.includes("upload") || a.includes("download");
    }).length;
  }

  const { data: categoryRows } = await supabase
    .from("audit_logs")
    .select("action_category, action_type")
    .gte("timestamp", since24h)
    .limit(5000);

  const byCategory: Record<string, number> = {};
  for (const row of categoryRows ?? []) {
    const r = row as { action_category?: string | null; action_type?: string };
    const c = r.action_category || inferFromAction(r.action_type ?? "");
    byCategory[c] = (byCategory[c] ?? 0) + 1;
  }

  return NextResponse.json({
    last24h: recentRes.count ?? 0,
    admin24h: adminRes.count ?? 0,
    employee24h: employeeRes.count ?? 0,
    fileActions24h,
    byCategory,
  });
}

function inferFromAction(actionType: string): string {
  const a = actionType.toLowerCase();
  if (a.includes("file") || a.includes("upload") || a.includes("download")) return "file";
  if (a.includes("import")) return "import";
  if (a.includes("export")) return "export";
  if (a.includes("assign")) return "assignment";
  if (a.includes("approv") || a.includes("leave")) return "approval";
  if (a.includes("login") || a.includes("logout")) return "auth";
  if (a.includes("create") || a.includes("update") || a.includes("delete")) return "data";
  return "api";
}
