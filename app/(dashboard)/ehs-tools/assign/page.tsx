import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { AdminBulkAssignEhsToolsClient } from "@/components/ehs/AdminBulkAssignEhsToolsClient";

export default async function AssignEhsToolsPage() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }

  const supabase = await getDataClient();

  const { data: catalogRows } = await supabase
    .from("assets")
    .select(
      "id, asset_id, name, category, status, assigned_to_employee_id, ehs_wear_role, ehs_tool_type, en_code"
    )
    .eq("is_ehs_tool", true)
    .order("asset_id");

  const empIds = [...new Set((catalogRows ?? []).map((r) => r.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: emps } = empIds.length
    ? await supabase.from("employees").select("id, full_name, email").in("id", empIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const nameById = new Map(
    (emps ?? []).map((e) => [e.id, (e.full_name ?? e.email ?? "Employee").trim() || "Employee"])
  );

  const searchCatalog = (catalogRows ?? []).map((r) => ({
    ...r,
    assigneeName: r.assigned_to_employee_id ? (nameById.get(r.assigned_to_employee_id) ?? "Employee") : null,
  }));

  const assets = searchCatalog.filter((a) => a.status === "Available" && !a.assigned_to_employee_id);

  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id, name, region_id, dt_employee_id, driver_rigger_employee_id")
    .not("dt_employee_id", "is", null)
    .order("name");

  const teamEmpIds = [
    ...new Set(
      (teamsRaw ?? []).flatMap((t) => [t.dt_employee_id, t.driver_rigger_employee_id].filter(Boolean) as string[])
    ),
  ];
  const { data: teamEmps } = teamEmpIds.length
    ? await supabase.from("employees").select("id, full_name, email, status").in("id", teamEmpIds)
    : { data: [] };
  const teamEmpMap = new Map(
    (teamEmps ?? []).map((e) => [e.id, { id: e.id, full_name: (e.full_name ?? e.email ?? "—").trim() || "—", status: e.status }])
  );

  const dtTeams = (teamsRaw ?? [])
    .filter((t) => {
      const dt = t.dt_employee_id ? teamEmpMap.get(t.dt_employee_id as string) : null;
      return dt && dt.status === "ACTIVE";
    })
    .map((t) => {
      const dt = teamEmpMap.get(t.dt_employee_id as string)!;
      const driver = t.driver_rigger_employee_id ? teamEmpMap.get(t.driver_rigger_employee_id as string) : null;
      return {
        teamId: t.id as string,
        teamName: (t.name as string)?.trim() || "Team",
        dt: { id: dt.id, full_name: dt.full_name },
        driver: driver && driver.status === "ACTIVE" ? { id: driver.id, full_name: driver.full_name } : null,
      };
    });

  return (
    <div className="space-y-5">
      <nav className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/ehs-tools" className="hover:text-zinc-900">
          EHS Tools
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Assign</span>
      </nav>
      <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Assign EHS tools</h1>
        <p className="mt-1 text-sm text-zinc-600">
          All EHS tools assign to the team DT. Driver/Rigger wear items stay linked to that team&apos;s driver.
        </p>
        <span className="mt-4 inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
          Teams with DT: {dtTeams.length} · Available tools: {assets.length}
        </span>
      </div>
      <AdminBulkAssignEhsToolsClient assets={assets} searchCatalog={searchCatalog} dtTeams={dtTeams} />
    </div>
  );
}
