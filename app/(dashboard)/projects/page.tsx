import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";

export default async function ProjectsPage() {
  if (!(await can("projects.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, project_type, created_at")
    .order("name");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Projects</h1>
      <DataTable
        keyField="id"
        data={projects ?? []}
        hrefPrefix="/projects/"
        filterKeys={["project_type"]}
        searchPlaceholder="Search projects…"
        toolbarTrailing={
          <Link href="/projects/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add project
          </Link>
        }
        columns={[
          { key: "name", label: "Name" },
          { key: "project_type", label: "Type" },
        ]}
      />
    </div>
  );
}
