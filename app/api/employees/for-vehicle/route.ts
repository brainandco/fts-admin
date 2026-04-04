import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { formatEmployeeRoleDisplay } from "@/lib/employees/employee-role-options";

/** Returns all employees for vehicle assignee (Name) dropdown. */
export async function GET() {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, phone, email, project_id, region_id")
    .order("full_name");

  const ids = (employees ?? []).map((e) => e.id);
  const { data: roles } = ids.length
    ? await supabase.from("employee_roles").select("employee_id, role, role_custom").in("employee_id", ids)
    : { data: [] };
  const rolesByEmp = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = rolesByEmp.get(r.employee_id) ?? [];
    arr.push(formatEmployeeRoleDisplay(r.role, r.role_custom));
    rolesByEmp.set(r.employee_id, arr);
  }

  const list = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    phone: e.phone ?? null,
    email: e.email ?? null,
    designation: (rolesByEmp.get(e.id) ?? []).join(", ") || null,
    project_id: e.project_id ?? null,
    region_id: e.region_id ?? null,
  }));
  return NextResponse.json({ employees: list });
}
