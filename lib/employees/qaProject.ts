import type { SupabaseClient } from "@supabase/supabase-js";

/** QA employees are always linked to this project (must exist in `projects`). */
export const QA_EMPLOYEE_PROJECT_NAME = "Huawei Minor Project";

export async function getQaProjectId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("projects").select("id").eq("name", QA_EMPLOYEE_PROJECT_NAME).maybeSingle();
  return data?.id ?? null;
}
