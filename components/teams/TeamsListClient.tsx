"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import type { RowAction } from "@/components/ui/DataTable";
import { TeamBulkCredentialsEmailLauncher } from "@/components/teams/TeamBulkCredentialsEmailLauncher";

export type TeamListRow = Record<string, unknown> & {
  id: string;
  name: string;
  member_count: number;
  last_team_credentials_email_sent_at?: string | null;
};

export function TeamsListClient({ rows }: { rows: TeamListRow[] }) {
  const [emailTeam, setEmailTeam] = useState<TeamListRow | null>(null);

  return (
    <>
      <DataTable<TeamListRow>
        keyField="id"
        data={rows}
        rowActions={(row): RowAction<TeamListRow>[] => {
          const actions: RowAction<TeamListRow>[] = [
            { label: "View", href: `/teams/${row.id}` },
          ];
          if (row.member_count > 0) {
            actions.push({
              label: "Email members",
              icon: "link",
              onClick: () => setEmailTeam(row),
            });
          }
          return actions;
        }}
        filterKeys={["project_name", "region_name"]}
        searchPlaceholder="Search teams…"
        toolbarTrailing={
          <a href="/teams/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add team
          </a>
        }
        columns={[
          { key: "team_code_display", label: "Code" },
          { key: "name", label: "Name" },
          { key: "project_name", label: "Project" },
          { key: "region_name", label: "Region" },
          { key: "dt_name", label: "DT" },
          { key: "driver_rigger_name", label: "Driver/Rigger" },
          { key: "last_bulk_email_display", label: "Last team email", format: "text" },
          { key: "onboarding_date", label: "Onboarding" },
          { key: "max_size", label: "Max size", format: "text" },
        ]}
      />
      {emailTeam && emailTeam.member_count > 0 ? (
        <TeamBulkCredentialsEmailLauncher
          key={emailTeam.id}
          teamId={emailTeam.id}
          teamName={String(emailTeam.name)}
          memberCount={emailTeam.member_count}
          onClose={() => setEmailTeam(null)}
        />
      ) : null}
    </>
  );
}
