"use client";

import type { TeamMemberPick } from "@/lib/admin-assignment/team-region-lists";

export function AdminTeamRegionEmployeePicker({
  teams,
  disabled,
  disabledReason,
  value,
  onChange,
}: {
  teams: TeamMemberPick[];
  disabled?: boolean;
  disabledReason?: string;
  value: { teamId: string; employeeId: string };
  onChange: (v: { teamId: string; employeeId: string }) => void;
}) {
  const members = teams.find((t) => t.teamId === value.teamId)?.members ?? [];
  const selectClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm bg-white";

  if (disabled) {
    return <p className="text-sm text-zinc-500">{disabledReason ?? "Select a region first."}</p>;
  }

  if (teams.length === 0) {
    return (
      <p className="text-sm text-amber-800">
        No eligible employees in this region for this assignment type. Add teams or check roles (DT / driver / field roles).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Team or group</label>
        <select
          className={selectClass}
          value={teams.some((t) => t.teamId === value.teamId) ? value.teamId : teams[0].teamId}
          onChange={(e) => {
            const tid = e.target.value;
            const t = teams.find((x) => x.teamId === tid);
            const eid = t?.members[0]?.id ?? "";
            onChange({ teamId: tid, employeeId: eid });
          }}
        >
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.teamName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Employee</label>
        <select
          className={selectClass}
          value={members.some((m) => m.id === value.employeeId) ? value.employeeId : (members[0]?.id ?? "")}
          onChange={(e) => onChange({ teamId: value.teamId, employeeId: e.target.value })}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
