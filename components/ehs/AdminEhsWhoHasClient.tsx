"use client";

import Link from "next/link";
import type { TeamEhsBlock, EhsToolLine } from "@/lib/assets/load-team-ehs-assignments";

function ToolList({ tools, emptyLabel }: { tools: EhsToolLine[]; emptyLabel: string }) {
  if (tools.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-zinc-700">
      {tools.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-1 last:border-0">
          <Link href={`/ehs-tools/${t.id}`} className="font-mono text-xs text-indigo-700 hover:underline">
            {t.asset_id}
          </Link>
          <span>{t.name}</span>
          <span className="text-xs text-zinc-500">{t.en_code}</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{t.status.replace(/_/g, " ")}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminEhsWhoHasClient({ teams }: { teams: TeamEhsBlock[] }) {
  if (teams.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
        No assigned EHS tools on active teams yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {teams.map((team) => (
        <article key={team.teamId} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <header className="mb-4 border-b border-zinc-100 pb-3">
            <h2 className="text-lg font-semibold text-zinc-900">{team.teamName}</h2>
            <p className="text-sm text-zinc-500">{team.regionLabel}</p>
          </header>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-800">DT — {team.dt.full_name}</h3>
              <ToolList tools={team.dtTools} emptyLabel="No DT wear tools assigned." />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-800">
                Driver/Rigger — {team.driver?.full_name ?? "No driver on team"}
              </h3>
              <ToolList tools={team.driverTools} emptyLabel="No driver/rigger wear tools assigned." />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
