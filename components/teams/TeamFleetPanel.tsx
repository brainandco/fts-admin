"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoModal } from "@/components/ui/InfoModal";
import type { TeamMemberFleetSummary } from "@/lib/teams/unassignTeamMemberFleet";

type Props = {
  teamId: string;
  fleet: TeamMemberFleetSummary;
  canUnassign: boolean;
  dtId: string | null;
  drId: string | null;
};

function memberRoleLabel(employeeId: string, dtId: string | null, drId: string | null): string {
  if (dtId && drId && dtId === drId && employeeId === dtId) return "Self DT";
  if (employeeId === dtId) return "DT";
  if (employeeId === drId) return "Driver/Rigger";
  return "";
}

export function TeamFleetPanel({ teamId, fleet, canUnassign, dtId, drId }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalItems = fleet.assets.length + fleet.sims.length + fleet.vehicles.length;

  async function unassignAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/unassign-fleet`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Unassign failed");
        return;
      }
      setConfirmOpen(false);
      setMessage(
        `Unassigned ${data.assetsUnassigned ?? 0} tool(s), ${data.simsUnassigned ?? 0} SIM(s), and ${data.vehiclesUnassigned ?? 0} vehicle(s). You can terminate the team when ready.`
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section id="team-tools-vehicle" className="rounded-xl border border-zinc-200 bg-white shadow-sm scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Tools, SIMs &amp; vehicle</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Everything assigned to this team&apos;s DT and Driver/Rigger. Unassign here before terminating the team.
            </p>
          </div>
          {canUnassign && totalItems > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              Unassign all ({totalItems})
            </button>
          ) : null}
        </div>

        <div className="space-y-8 p-6">
          <FleetTable
            title="Tools / assets"
            empty="No tools assigned to team members."
            columns={["Serial", "Name", "Type", "Assignee", "Status", ""]}
            rows={fleet.assets.map((a) => ({
              key: a.id,
              cells: [
                a.serial ?? "—",
                a.name ?? "—",
                a.category ?? "—",
                `${a.employee_name}${memberRoleLabel(a.employee_id, dtId, drId) ? ` (${memberRoleLabel(a.employee_id, dtId, drId)})` : ""}`,
                a.status ?? "—",
              ],
              href: `/assets/${a.id}?returnTo=${encodeURIComponent(`/teams/${teamId}`)}`,
            }))}
          />

          <FleetTable
            title="SIM cards"
            empty="No SIMs assigned to team members."
            columns={["SIM number", "Phone", "Assignee", "Status", ""]}
            rows={fleet.sims.map((s) => ({
              key: s.id,
              cells: [
                s.sim_number ?? "—",
                s.phone_number ?? "—",
                `${s.employee_name}${memberRoleLabel(s.employee_id, dtId, drId) ? ` (${memberRoleLabel(s.employee_id, dtId, drId)})` : ""}`,
                s.status ?? "—",
              ],
              href: `/sims/${s.id}`,
            }))}
          />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-800">Vehicle assignments</h3>
            {fleet.vehicles.length === 0 ? (
              <p className="text-sm text-zinc-500">No vehicle assignments for team members.</p>
            ) : (
              <ul className="space-y-2">
                {fleet.vehicles.map((row) => (
                  <li
                    key={`${row.vehicle_id}-${row.employee_id}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3"
                  >
                    <span className="font-semibold text-zinc-900">{row.plate_number ?? row.vehicle_id}</span>
                    {row.vehicle_type ? <span className="text-sm text-zinc-600">{row.vehicle_type}</span> : null}
                    <span className="text-sm text-zinc-600">Status: {row.status ?? "—"}</span>
                    <span className="text-sm text-zinc-700">
                      Assigned to: <strong>{row.employee_name}</strong>
                      {memberRoleLabel(row.employee_id, dtId, drId)
                        ? ` (${memberRoleLabel(row.employee_id, dtId, drId)})`
                        : null}
                    </span>
                    <Link href={`/vehicles/${row.vehicle_id}`} className="text-sm font-medium text-indigo-700 hover:underline">
                      Open vehicle →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canUnassign && totalItems > 0 ? (
            <p className="text-xs text-zinc-500">
              <strong>Unassign all</strong> clears assignees and sets each resource to Available. Pending receipt records
              are removed. Use this when preparing to terminate the team — no need to visit Assets, SIMs, or Vehicles
              separately.
            </p>
          ) : null}
        </div>
      </section>

      <ConfirmModal
        open={confirmOpen}
        title="Unassign all team fleet items?"
        message={`This will unassign ${fleet.assets.length} tool(s), ${fleet.sims.length} SIM(s), and ${fleet.vehicles.length} vehicle(s) from this team's members. Resources return to Available. Continue?`}
        confirmLabel="Yes, unassign all"
        cancelLabel="Cancel"
        variant="danger"
        loading={loading}
        onConfirm={() => void unassignAll()}
        onCancel={() => !loading && setConfirmOpen(false)}
      />
      <InfoModal
        open={!!message}
        title="Fleet unassigned"
        message={message ?? ""}
        onClose={() => setMessage(null)}
      />
      <InfoModal open={!!error} title="Could not unassign" message={error ?? ""} variant="danger" onClose={() => setError(null)} />
    </>
  );
}

function FleetTable({
  title,
  empty,
  columns,
  rows,
}: {
  title: string;
  empty: string;
  columns: string[];
  rows: { key: string; cells: string[]; href: string }[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2 text-left font-medium text-zinc-700">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-4 py-2 text-zinc-800">
                      {cell}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <Link href={row.href} className="font-medium text-indigo-700 hover:underline">
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
  );
}
