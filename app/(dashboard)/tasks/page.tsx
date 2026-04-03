import { getDataClient } from "@/lib/supabase/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";

export default async function TasksPage() {
  if (!(await can("tasks.view_all"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { profile } = await getCurrentUserProfile();
  let query = supabase.from("tasks").select("id, title, status, priority, due_date, region_id, created_at").order("created_at", { ascending: false });
  if (profile?.region_id && !profile?.is_super_user) query = query.eq("region_id", profile.region_id);
  const { data: tasks } = await query;

  const regionIds = [...new Set((tasks ?? []).map((t) => t.region_id))];
  const { data: regions } = await supabase.from("regions").select("id, name").in("id", regionIds);
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));

  const rows = (tasks ?? []).map((t) => ({
    ...t,
    region_name: regionMap.get(t.region_id) ?? t.region_id,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Tasks</h1>
      <DataTable
        keyField="id"
        data={rows}
        hrefPrefix="/tasks/"
        filterKeys={["status", "priority", "region_name"]}
        searchPlaceholder="Search tasks…"
        toolbarTrailing={
          <Link href="/tasks/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add task
          </Link>
        }
        columns={[
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "due_date", label: "Due", format: "date" },
          { key: "region_name", label: "Region" },
        ]}
      />
    </div>
  );
}
