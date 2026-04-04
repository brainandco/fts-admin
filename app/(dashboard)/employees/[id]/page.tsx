import { getDataClient } from "@/lib/supabase/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { ResendCredentialsButton } from "@/components/employees/ResendCredentialsButton";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("users.edit"))) redirect("/employees");

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!employee) notFound();

  const { data: roleRows } = await supabase.from("employee_roles").select("role").eq("employee_id", id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const employeeWithRoles = { ...employee, roles };

  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user ?? false;

  const [assignmentsRes, assetsRes] = await Promise.all([
    supabase.from("vehicle_assignments").select("vehicle_id").eq("employee_id", id),
    supabase.from("assets").select("id, name, serial, category, status, assigned_by, software_connectivity").eq("assigned_to_employee_id", id),
  ]);
  const vehicleIds = (assignmentsRes.data ?? []).map((a) => a.vehicle_id);
  const assetsList = assetsRes.data ?? [];
  const assignedByUserIds = [...new Set(assetsList.map((a) => a.assigned_by).filter(Boolean) as string[])];
  const { data: assignedByUsers } = assignedByUserIds.length
    ? await supabase.from("users_profile").select("id, full_name, email").in("id", assignedByUserIds)
    : { data: [] };
  const assignedByMap = new Map((assignedByUsers ?? []).map((u) => [u.id, u.full_name || u.email]));

  const { data: vehiclesList } = vehicleIds.length
    ? await supabase.from("vehicles").select("id, plate_number, vehicle_type, status").in("id", vehicleIds)
    : { data: [] };

  const { data: region } = employee.region_id
    ? await supabase.from("regions").select("name").eq("id", employee.region_id).single()
    : { data: null };
  const { data: project } = employee.project_id
    ? await supabase.from("projects").select("name").eq("id", employee.project_id).single()
    : { data: null };

  const displayName = employee.full_name || "Employee";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/employees" className="hover:text-zinc-900">Employees</Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">{displayName}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900">{displayName}</h1>
            {employee.email && (
              <p className="mt-1 text-sm text-zinc-500">{employee.email}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                  employee.status === "ACTIVE"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-zinc-100 text-zinc-600"
                }`}
              >
                {employee.status}
              </span>
              {region?.name && (
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  {region.name}
                </span>
              )}
              {(project?.name || employee.project_name_other) && (
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  {project?.name || employee.project_name_other}
                </span>
              )}
            </div>
            {roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
          {employee.email && (
            <div className="shrink-0">
              <ResendCredentialsButton employeeId={id} />
            </div>
          )}
        </div>
      </div>

      {/* Edit employee card */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Profile & roles</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Edit details, role, and status. Region and project are not edited here — assign them after creation
            {isSuper ? (
              <>
                {" "}
                on{" "}
                <Link href="/employees/region-project-assignments" className="font-medium text-indigo-600 hover:text-indigo-800">
                  Region &amp; project assignments
                </Link>
              </>
            ) : (
              <> (Super User)</>
            )}
            .
          </p>
        </div>
        <div className="p-6">
          <EmployeeForm existing={employeeWithRoles} canDeleteEmployee={isSuper} />
        </div>
      </div>

      {/* Assigned assets card */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Assigned assets</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Assets currently with this employee. Assigned by shows who assigned it (e.g. QC or Admin).</p>
        </div>
        <div className="p-6">
          {!assetsList.length ? (
            <p className="text-sm text-zinc-500">No assets assigned.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Serial</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Software</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Assigned by</th>
                    <th className="w-0 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {assetsList.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{a.serial ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-900">{a.name ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{a.category ?? "—"}</td>
                      <td className="max-w-[12rem] px-4 py-3 text-zinc-600">{a.software_connectivity?.trim() || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{a.status ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{a.assigned_by ? assignedByMap.get(a.assigned_by) ?? "—" : "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/assets/${a.id}`} className="font-medium text-zinc-900 hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assigned vehicles card */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Assigned vehicles</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Vehicles currently assigned to this employee. Unassign in Vehicles before deleting the employee.</p>
        </div>
        <div className="p-6">
          {!vehiclesList?.length ? (
            <p className="text-sm text-zinc-500">No vehicles assigned.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Plate</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
                    <th className="w-0 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {vehiclesList.map((v) => (
                    <tr key={v.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{v.plate_number ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{v.vehicle_type ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{v.status ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/vehicles/${v.id}`} className="font-medium text-zinc-900 hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Activity history */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Activity history</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Recent changes to this employee.</p>
        </div>
        <div className="p-6">
          <EntityHistory entityType="employee" entityId={id} showTitle={false} />
        </div>
      </div>
    </div>
  );
}
