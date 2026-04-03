import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";

export default async function RegionsPage() {
  if (!(await can("regions.manage"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { data: regions } = await supabase
    .from("regions")
    .select("id, name, code, created_at")
    .order("name");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Regions</h1>
      <DataTable
        keyField="id"
        data={regions ?? []}
        hrefPrefix="/regions/"
        searchPlaceholder="Search regions…"
        toolbarTrailing={
          <Link href="/regions/new" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Add region
          </Link>
        }
        columns={[
          { key: "name", label: "Name" },
          { key: "code", label: "Code" },
        ]}
      />
    </div>
  );
}
