import { getDataClient } from "@/lib/supabase/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { VehiclesTabs } from "@/components/vehicles/VehiclesTabs";
import { formatEmployeeRoleDisplay } from "@/lib/employees/employee-role-options";

export default async function VehiclesPage() {
  if (!(await can("vehicles.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { profile } = await getCurrentUserProfile();
  let query = supabase
    .from("vehicles")
    .select("id, plate_number, vehicle_type, rent_company, make, model, assignment_type, status")
    .order("plate_number");
  const { data: vehicles } = await query;

  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  const { data: assignments } = vehicleIds.length
    ? await supabase.from("vehicle_assignments").select("vehicle_id, employee_id").in("vehicle_id", vehicleIds)
    : { data: [] };
  const employeeIds = [...new Set((assignments ?? []).map((a) => a.employee_id))];
  const { data: employees } = employeeIds.length
    ? await supabase.from("employees").select("id, full_name, phone, email, project_id, region_id").in("id", employeeIds)
    : { data: [] };
  const { data: roleRows } = employeeIds.length
    ? await supabase.from("employee_roles").select("employee_id, role, role_custom").in("employee_id", employeeIds)
    : { data: [] };
  const rolesByEmp = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByEmp.get(r.employee_id) ?? [];
    arr.push(formatEmployeeRoleDisplay(r.role, r.role_custom));
    rolesByEmp.set(r.employee_id, arr);
  }

  const assignmentByVehicle = new Map((assignments ?? []).map((a) => [a.vehicle_id, a]));
  const employeeById = new Map((employees ?? []).map((e) => [e.id, e]));

  const projectIds = [...new Set((employees ?? []).map((e) => e.project_id).filter(Boolean) as string[])];
  const regionIds = [...new Set((employees ?? []).map((e) => e.region_id).filter(Boolean) as string[])];
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const { data: regions } = await supabase.from("regions").select("id, name").in("id", regionIds);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));

  const allRows = (vehicles ?? []).map((v) => ({
    id: v.id,
    plate_number: v.plate_number,
    vehicle_type: v.vehicle_type ?? "—",
    rent_company: v.rent_company ?? "—",
    make: v.make ?? "—",
    model: v.model ?? "—",
    assignment_type: v.assignment_type ?? "Permanent",
    status: v.status,
  }));

  const assignedRows = (vehicles ?? [])
    .filter((v) => assignmentByVehicle.has(v.id))
    .map((v) => {
      const a = assignmentByVehicle.get(v.id)!;
      const e = employeeById.get(a.employee_id);
      const project_name = e?.project_id ? projectMap.get(e.project_id) ?? "—" : "—";
      const region_name = e?.region_id ? regionMap.get(e.region_id) ?? "—" : "—";
      return {
        id: v.id,
        name_display: e?.full_name?.trim() || "—",
        designation: e ? (rolesByEmp.get(e.id) ?? []).join(", ") || "—" : "—",
        contact: e ? (e.phone || e.email || "—") : "—",
        plate_number: v.plate_number,
        vehicle_type: v.vehicle_type ?? "—",
        assignment_type: v.assignment_type ?? "Permanent",
        project_name,
        region_name,
        make: v.make ?? "—",
        model: v.model ?? "—",
      };
    });

  return <VehiclesTabs allRows={allRows} assignedRows={assignedRows} />;
}
