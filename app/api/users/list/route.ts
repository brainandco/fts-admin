import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

export async function GET() {
  if (!(await can("users.view"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const supabase = await getDataClient();
  const [usersRes, employeesRes] = await Promise.all([
    supabase
      .from("users_profile")
      .select("id, email, full_name, is_super_user, employee_portal_only")
      .order("email"),
    supabase.from("employees").select("email"),
  ]);
  const users = usersRes.data ?? [];
  const employeeEmails = new Set((employeesRes.data ?? []).map((e) => (e.email ?? "").toLowerCase().trim()).filter(Boolean));
  const adminOnly = users.filter((u) => {
    if (u.employee_portal_only === true) return false;
    return !employeeEmails.has((u.email ?? "").toLowerCase().trim());
  });
  return NextResponse.json({ users: adminOnly });
}
