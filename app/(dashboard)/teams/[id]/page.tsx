import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { PERMISSION_TEAMS_TERMINATE } from "@/lib/rbac/permission-codes";
import { TeamForm } from "@/components/teams/TeamForm";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { TerminateTeamButton } from "@/components/teams/TerminateTeamButton";
import { SendTeamMemberCredentialsButton } from "@/components/teams/SendTeamMemberCredentialsButton";
import { SyncTeamFromDtButton } from "@/components/teams/SyncTeamFromDtButton";
import { TeamFleetPanel } from "@/components/teams/TeamFleetPanel";
import {
  getTeamTerminationBlockers,
  teamTerminationBlockedMessage,
} from "@/lib/teams/teamTermination";
import { fetchTeamMemberFleet } from "@/lib/teams/unassignTeamMemberFleet";
import { FormCallout } from "@/components/ui/FormSection";

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
  const canManageTeams = await can("teams.manage");
  const canTerminateTeam = await can(PERMISSION_TEAMS_TERMINATE);
  const canUnassignFleet =
    canManageTeams &&
    ((await can("assets.manage")) ||
      (await can("assets.assign")) ||
      (await can("vehicles.manage")) ||
      (await can("vehicles.assign")));

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

  const [dtEmpRes, drEmpRes, projectRes, regionRes, teamFleet] = await Promise.all([
    dtId ? supabase.from("employees").select("full_name").eq("id", dtId).single() : { data: null },
    drId ? supabase.from("employees").select("full_name").eq("id", drId).single() : { data: null },
    team.project_id ? supabase.from("projects").select("name").eq("id", team.project_id).single() : { data: null },
    team.region_id ? supabase.from("regions").select("name").eq("id", team.region_id).single() : { data: null },
    fetchTeamMemberFleet(supabase, { dt_employee_id: dtId, driver_rigger_employee_id: drId }),
  ]);
  const dtEmp = dtEmpRes.data;
  const drEmp = drEmpRes.data;
  const project = projectRes.data;
  const region = regionRes.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
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
          {!project?.name && team.project_id ? (
            <span className="text-sm font-normal text-zinc-400">· Project id on file (no name)</span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-start">
          {isSuper && dtId && drId ? <SyncTeamFromDtButton teamId={id} /> : null}
          {canTerminateTeam ? (
            <TerminateTeamButton
              teamId={id}
              teamName={team.name}
              canTerminate={terminationBlockers.canTerminate}
              blockReason={terminationBlockedMessage}
            />
          ) : null}
        </div>
      </div>
      <section className="space-y-6">
        <h2 className="text-lg font-medium text-zinc-900">Edit team</h2>
        <div className="max-w-3xl space-y-4">
          <FormCallout variant="warning" title="Before you change members">
            You cannot replace a DT or Driver/Rigger while they still have assigned assets, SIMs, or a vehicle. They must
            return everything via the Employee Portal (QC is notified) before you save a new member. Terminating the team is
            blocked until the same is true for every member.
          </FormCallout>
          <FormCallout variant="info" title="Region &amp; project">
            They follow the <strong>DT</strong> (or Self DT) employee — update on{" "}
            <Link href="/employees/region-project-assignments">Employee region &amp; project assignments</Link>. Changing
            the DT&apos;s region there moves the <strong>whole team</strong> (Driver/Rigger region and team row sync
            automatically). Project changes update this team too. Super Users can use{" "}
            <strong>Sync region &amp; project from DT</strong> above if the team row is stale. Assigned tools, SIMs, and
            vehicles stay with the same people.
          </FormCallout>
        </div>
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
                Unassign every tool, SIM, and vehicle from this team&apos;s members before terminating. Use{" "}
                <strong>Unassign all</strong> in Tools, SIMs &amp; vehicle below, or collect returns via the Employee Portal.
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
                    Tools, SIMs &amp; vehicle
                  </Link>{" "}
                  below lists everything still assigned.
                </p>
              )}
            </div>
          )}
          <ul className="space-y-1 text-sm text-zinc-700">
            {dtId && <li><strong>DT:</strong> {dtEmp?.full_name ?? dtId}</li>}
            {drId && <li><strong>Driver/Rigger:</strong> {drEmp?.full_name ?? drId}</li>}
          </ul>
          {canManageTeams && (
            <div className="mt-5 border-t border-zinc-100 pt-5">
              <h3 className="mb-2 text-sm font-medium text-zinc-800">Employee Portal credentials</h3>
              <p className="mb-3 text-xs text-zinc-500">
                Sends the same credential email as on each employee&apos;s page (new temporary password per person). Only
                current DT and Driver/Rigger on this team receive it. You can also trigger this from the{" "}
                <Link href="/teams" className="font-medium text-indigo-700 underline hover:text-indigo-900">
                  Teams list
                </Link>{" "}
                (Actions → Email members). When at least one email is delivered, the team&apos;s “Last team email” timestamp is updated.
              </p>
              {(team as { last_team_credentials_email_sent_at?: string | null }).last_team_credentials_email_sent_at ? (
                <p className="mb-3 text-xs text-zinc-600">
                  Last team bulk send:{" "}
                  <span className="font-medium text-zinc-800">
                    {new Date(
                      String((team as { last_team_credentials_email_sent_at?: string }).last_team_credentials_email_sent_at)
                    ).toLocaleString()}
                  </span>
                </p>
              ) : (
                <p className="mb-3 text-xs text-zinc-500">No team bulk credentials email recorded yet.</p>
              )}
              <SendTeamMemberCredentialsButton
                teamId={id}
                memberCount={[dtId, drId].filter(Boolean).length}
              />
            </div>
          )}
        </section>
      )}
      {(dtId || drId) && (
        <TeamFleetPanel
          teamId={id}
          fleet={teamFleet}
          canUnassign={canUnassignFleet}
          dtId={dtId}
          drId={drId}
        />
      )}
      <EntityHistory entityType="team" entityId={id} />
    </div>
  );
}
