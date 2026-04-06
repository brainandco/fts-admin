import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import { TeamForm } from "@/components/teams/TeamForm";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { TerminateTeamButton } from "@/components/teams/TerminateTeamButton";
import {
  getTeamTerminationBlockers,
  teamTerminationBlockedMessage,
} from "@/lib/teams/teamTermination";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userClient = await createServerSupabaseClient();
  const supabase = await getDataClient();
  const { data: team } = await userClient.from("teams").select("*").eq("id", id).single();
  if (!team) notFound();

  const terminationBlockers = await getTeamTerminationBlockers(supabase, {
    dt_employee_id: team.dt_employee_id ?? null,
    driver_rigger_employee_id: team.driver_rigger_employee_id ?? null,
  });
  const terminationBlockedMessage = terminationBlockers.canTerminate
    ? null
    : teamTerminationBlockedMessage(terminationBlockers);

  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user ?? false;

  const { data: employees } = await supabase.from("employees").select("id, full_name, region_id").eq("status", "ACTIVE");
  const { data: teams } = await supabase.from("teams").select("id, dt_employee_id, driver_rigger_employee_id");
  const empIds = (employees ?? []).map((e) => e.id);
  const { data: roleRows } = await supabase.from("employee_roles").select("employee_id, role, role_custom").in("employee_id", empIds);
  const rolesByEmpId = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByEmpId.get(r.employee_id) ?? [];
    arr.push(r.role);
    rolesByEmpId.set(r.employee_id, arr);
  }
  const employeesWithRoles = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    region_id: e.region_id ?? null,
    roles: rolesByEmpId.get(e.id) ?? [],
  }));
  const unavailableEmployeeIds = Array.from(
    new Set(
      (teams ?? [])
        .filter((t) => t.id !== id)
        .flatMap((t) => [t.dt_employee_id, t.driver_rigger_employee_id].filter(Boolean) as string[])
    )
  );

  const dtId = team.dt_employee_id ?? null;
  const drId = team.driver_rigger_employee_id ?? null;
  const memberIdsForFleet = [...new Set([dtId, drId].filter(Boolean))] as string[];

  const [dtEmpRes, drEmpRes, projectRes, regionRes, dtAssetsRes, teamVehicleAssignRes] = await Promise.all([
    dtId ? supabase.from("employees").select("full_name").eq("id", dtId).single() : { data: null },
    drId ? supabase.from("employees").select("full_name").eq("id", drId).single() : { data: null },
    team.project_id ? supabase.from("projects").select("name").eq("id", team.project_id).single() : { data: null },
    team.region_id ? supabase.from("regions").select("name").eq("id", team.region_id).single() : { data: null },
    dtId ? supabase.from("assets").select("id, name, serial, category, status").eq("assigned_to_employee_id", dtId).order("name") : { data: [] },
    memberIdsForFleet.length
      ? supabase
          .from("vehicle_assignments")
          .select(
            "vehicle_id, employee_id, vehicles(id, plate_number, vehicle_type, status), employees(full_name)"
          )
          .in("employee_id", memberIdsForFleet)
      : { data: [] },
  ]);
  const dtEmp = dtEmpRes.data;
  const drEmp = drEmpRes.data;
  const project = projectRes.data;
  const region = regionRes.data;
  const dtAssets = dtAssetsRes.data ?? [];

  type VehicleEmbed = { id: string; plate_number: string | null; vehicle_type: string | null; status: string | null };
  type EmpEmbed = { full_name: string | null };

  function one<T>(x: T | T[] | null | undefined): T | null {
    if (x == null) return null;
    return Array.isArray(x) ? (x[0] ?? null) : x;
  }

  const teamVehicleAssignments = (teamVehicleAssignRes.data ?? []).map((raw: Record<string, unknown>) => ({
    vehicle_id: String(raw.vehicle_id ?? ""),
    employee_id: String(raw.employee_id ?? ""),
    vehicles: one(raw.vehicles as VehicleEmbed | VehicleEmbed[] | null),
    employees: one(raw.employees as EmpEmbed | EmpEmbed[] | null),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/teams" className="text-sm text-zinc-500 hover:text-zinc-900">← Teams</Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-zinc-900">
            {team.name}
            {(team as { team_code?: string | null }).team_code?.trim() ? (
              <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-sm font-semibold tracking-wide text-indigo-900">
                {(team as { team_code?: string | null }).team_code!.trim()}
              </span>
            ) : null}
          </h1>
          {region?.name ? (
            <span className="text-sm font-normal text-zinc-500">· {region.name}</span>
          ) : null}
          {project?.name ? <span className="text-sm font-normal text-zinc-500">· {project.name}</span> : null}
        </div>
        {isSuper && (
          <TerminateTeamButton
            teamId={id}
            teamName={team.name}
            canTerminate={terminationBlockers.canTerminate}
            blockReason={terminationBlockedMessage}
          />
        )}
      </div>
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Edit team</h2>
        <p className="mb-4 max-w-2xl rounded-lg border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
          You cannot replace a DT or Driver/Rigger while they still have assigned assets, SIMs, or a vehicle. They must return
          everything via the Employee Portal (QC is notified) before you save a new member. Terminating the team is blocked
          until the same is true for every member.
        </p>
        <p className="mb-4 text-sm text-zinc-600">
          Region and project on this team follow the <strong>DT</strong> (or Self DT) employee — update them on{" "}
          <Link href="/employees/region-project-assignments" className="font-medium text-indigo-600 hover:text-indigo-800">
            Employee region &amp; project assignments
          </Link>
          . Driver/Rigger must stay in the same region as the DT when you change members.
        </p>
        <TeamForm existing={team} employees={employeesWithRoles} unavailableEmployeeIds={unavailableEmployeeIds} />
      </section>
      {(dtId || drId) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-medium text-zinc-900">Members (1 DT + 1 Driver/Rigger)</h2>
          <p className="mb-4 text-sm text-zinc-500">Tools are assigned to the DT; vehicle is assigned to the Driver/Rigger. Track both below.</p>
          {!terminationBlockers.canTerminate && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Termination is blocked until all items are collected</p>
              <p className="mt-1 text-amber-900/90">
                QC/PM must unassign every tool, SIM, and vehicle from this team&apos;s members before a Super User can
                terminate the team.
                {terminationBlockers.assetCount > 0 && (
                  <span className="ml-1">Tools/assets still assigned: {terminationBlockers.assetCount}.</span>
                )}
                {terminationBlockers.simCount > 0 && (
                  <span className="ml-1">SIMs: {terminationBlockers.simCount}.</span>
                )}
                {terminationBlockers.vehicleCount > 0 && (
                  <span className="ml-1">Vehicles: {terminationBlockers.vehicleCount}.</span>
                )}
              </p>
              {(terminationBlockers.assetCount > 0 ||
                terminationBlockers.simCount > 0 ||
                terminationBlockers.vehicleCount > 0) && (
                <p className="mt-2 text-amber-900/90">
                  <strong>Where to verify:</strong>{" "}
                  <Link href="#team-tools-vehicle" className="font-medium underline hover:text-amber-950">
                    Tools &amp; vehicle
                  </Link>{" "}
                  below for the exact
                  tools, and every <strong>active vehicle assignment</strong> (plate + who it is assigned to). Termination
                  only checks the database: the assignee must use <strong>Employee Portal → Dashboard → Return vehicle</strong>{" "}
                  so the assignment row is removed. You can also open each vehicle in{" "}
                  <Link href="/vehicles" className="font-medium underline hover:text-amber-950">
                    Admin → Vehicles
                  </Link>{" "}
                  to see who still appears as assignee.
                </p>
              )}
            </div>
          )}
          <ul className="space-y-1 text-sm text-zinc-700">
            {dtId && <li><strong>DT:</strong> {dtEmp?.full_name ?? dtId}</li>}
            {drId && <li><strong>Driver/Rigger:</strong> {drEmp?.full_name ?? drId}</li>}
          </ul>
        </section>
      )}
      {(dtId || drId) && (
        <section id="team-tools-vehicle" className="rounded-xl border border-zinc-200 bg-white shadow-sm scroll-mt-6">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Tools & vehicle</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Tools assigned to the DT; <strong>vehicle assignments for either team member</strong> (DT or Driver/Rigger —
              this is what blocks termination until cleared).
            </p>
          </div>
          <div className="p-6 space-y-6">
            {dtId && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">Tools assigned to DT ({dtEmp?.full_name ?? "—"})</h3>
                {dtAssets.length === 0 ? (
                  <p className="text-sm text-zinc-500">No tools assigned. Assign assets to this employee in Assets.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-zinc-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Serial</th>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Name</th>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Type</th>
                          <th className="px-4 py-2 text-left font-medium text-zinc-700">Status</th>
                          <th className="w-0 px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {dtAssets.map((a) => (
                          <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                            <td className="px-4 py-2 font-medium text-zinc-900">{a.serial ?? "—"}</td>
                            <td className="px-4 py-2 text-zinc-900">{a.name ?? "—"}</td>
                            <td className="px-4 py-2 text-zinc-600">{a.category ?? "—"}</td>
                            <td className="px-4 py-2 text-zinc-600">{a.status ?? "—"}</td>
                            <td className="px-4 py-2">
                              <Link href={`/assets/${a.id}`} className="font-medium text-zinc-900 hover:underline">View →</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {(dtId || drId) && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">Vehicle assignments (team members)</h3>
                {teamVehicleAssignments.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No row in <code className="rounded bg-zinc-100 px-1 text-xs">vehicle_assignments</code> for this
                    team&apos;s DT or Driver/Rigger. If termination still fails, check SIMs or tools above.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {teamVehicleAssignments.map((row) => {
                      const v = row.vehicles;
                      const assigneeName = row.employees?.full_name?.trim() || row.employee_id;
                      return (
                        <li
                          key={`${row.vehicle_id}-${row.employee_id}`}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3"
                        >
                          <span className="font-medium text-zinc-900">{v?.plate_number ?? row.vehicle_id}</span>
                          {v?.vehicle_type ? <span className="text-zinc-600">{v.vehicle_type}</span> : null}
                          <span className="text-zinc-600">Status: {v?.status ?? "—"}</span>
                          <span className="text-zinc-600">
                            Assigned to: <strong className="text-zinc-800">{assigneeName}</strong>
                            {dtId && drId && dtId === drId && row.employee_id === dtId
                              ? " (Self DT)"
                              : (
                                  <>
                                    {row.employee_id === dtId ? " (DT)" : null}
                                    {row.employee_id === drId ? " (Driver/Rigger)" : null}
                                  </>
                                )}
                          </span>
                          {v?.id ? (
                            <Link href={`/vehicles/${v.id}`} className="font-medium text-zinc-900 hover:underline">
                              Open in Admin →
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2 text-xs text-zinc-500">
                  Clearing this requires the listed employee to submit <strong>Return vehicle</strong> on their Employee
                  Portal (Driver/Rigger or Self DT). PM assigns vehicles from the Employee Portal → Assign vehicles.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
      <EntityHistory entityType="team" entityId={id} />
    </div>
  );
}
