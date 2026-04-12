import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";

export default async function TeamsPage() {
  if (!(await can("teams.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, team_code, project_id, region_id, dt_employee_id, driver_rigger_employee_id, max_size, onboarding_date, created_at")
    .order("name");
  const projectIds = [...new Set((teams ?? []).map((t) => t.project_id))];
  const regionIds = [...new Set((teams ?? []).map((t) => t.region_id))];
  const empIds = [...new Set((teams ?? []).flatMap((t) => [t.dt_employee_id, t.driver_rigger_employee_id].filter(Boolean) as string[]))];
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const { data: regions } = await supabase.from("regions").select("id, name").in("id", regionIds);
  const { data: employees } = await supabase.from("employees").select("id, full_name").in("id", empIds);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  const rows = (teams ?? []).map((t) => ({
    ...t,
    team_code_display: (t as { team_code?: string | null }).team_code?.trim() || "—",
    project_name: projectMap.get(t.project_id) ?? t.project_id,
    region_name: t.region_id ? regionMap.get(t.region_id) ?? "" : "",
    dt_name: t.dt_employee_id ? employeeMap.get(t.dt_employee_id) ?? "" : "—",
    driver_rigger_name: t.driver_rigger_employee_id ? employeeMap.get(t.driver_rigger_employee_id) ?? "" : "—",
  }));

  const totalTeams = teams?.length ?? 0;
  const regionCounts = new Map<string, number>();
  for (const t of teams ?? []) {
    const label = t.region_id
      ? regionMap.get(t.region_id) ?? "Unknown region"
      : "No region";
    regionCounts.set(label, (regionCounts.get(label) ?? 0) + 1);
  }
  const regionCountRows = [...regionCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Teams</h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-500">Total teams</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">{totalTeams}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-500">By region</p>
          {regionCountRows.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No teams yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {regionCountRows.map(([regionName, count]) => (
                <li key={regionName} className="tabular-nums">
                  <span className="text-zinc-700">{regionName}</span>
                  <span className="ml-1.5 font-semibold text-zinc-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DataTable
        keyField="id"
        data={rows}
        hrefPrefix="/teams/"
        filterKeys={["project_name", "region_name"]}
        searchPlaceholder="Search teams…"
        toolbarTrailing={
          <Link href="/teams/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add team
          </Link>
        }
        columns={[
          { key: "team_code_display", label: "Code" },
          { key: "name", label: "Name" },
          { key: "project_name", label: "Project" },
          { key: "region_name", label: "Region" },
          { key: "dt_name", label: "DT" },
          { key: "driver_rigger_name", label: "Driver/Rigger" },
          { key: "onboarding_date", label: "Onboarding" },
          { key: "max_size", label: "Max size", format: "text" },
        ]}
      />
    </div>
  );
}
