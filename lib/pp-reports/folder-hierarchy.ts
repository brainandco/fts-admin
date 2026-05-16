import type { SupabaseClient } from "@supabase/supabase-js";

export type PpReportOperatorRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};
export type PpReportAccountRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};
export type PpReportProjectRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  operator_id: string;
  operator_name?: string;
};

export async function fetchPpReportHierarchyAdmin(supabase: SupabaseClient, includeInactive = true) {
  let operatorsQ = supabase.from("pp_report_operators").select("id, name, sort_order, is_active").order("sort_order").order("name");
  let accountsQ = supabase.from("pp_report_accounts").select("id, name, sort_order, is_active").order("sort_order").order("name");
  let projectsQ = supabase
    .from("pp_report_projects")
    .select("id, name, sort_order, is_active, operator_id, pp_report_operators(name)")
    .order("sort_order")
    .order("name");

  if (!includeInactive) {
    operatorsQ = operatorsQ.eq("is_active", true);
    accountsQ = accountsQ.eq("is_active", true);
    projectsQ = projectsQ.eq("is_active", true);
  }

  const [operatorsRes, accountsRes, projectsRes] = await Promise.all([operatorsQ, accountsQ, projectsQ]);
  if (operatorsRes.error) throw new Error(operatorsRes.error.message);
  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (projectsRes.error) throw new Error(projectsRes.error.message);

  const projects = (projectsRes.data ?? []).map((row) => {
    const op = row.pp_report_operators as { name?: string } | { name?: string }[] | null;
    const operator_name = Array.isArray(op) ? op[0]?.name : op?.name;
    return {
      id: row.id as string,
      name: row.name as string,
      sort_order: row.sort_order as number,
      is_active: row.is_active as boolean,
      operator_id: row.operator_id as string,
      operator_name: operator_name ?? undefined,
    };
  });

  return {
    operators: (operatorsRes.data ?? []) as PpReportOperatorRow[],
    accounts: (accountsRes.data ?? []) as PpReportAccountRow[],
    projects,
  };
}

export function normalizeHierarchyName(input: string, maxLen: number): string | null {
  const t = input.trim();
  if (!t || t.length > maxLen) return null;
  return t;
}
