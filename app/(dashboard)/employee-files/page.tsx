import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import Link from "next/link";
import { EmployeeFilesClient } from "./EmployeeFilesClient";

export default async function EmployeeFilesPage() {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    redirect("/dashboard");
  }

  const supabase = await getDataClient();
  const { data: regions } = await supabase.from("regions").select("id, name, code").order("name");
  const { data: folderRows } = await supabase
    .from("employee_file_region_folders")
    .select("id, region_id, path_segment, created_at")
    .order("path_segment");
  const regionIds = [...new Set((folderRows ?? []).map((f) => f.region_id))];
  const { data: regMeta } = regionIds.length
    ? await supabase.from("regions").select("id, name, code").in("id", regionIds)
    : { data: [] };
  const byRegion = new Map((regMeta ?? []).map((r) => [r.id, r] as const));
  const initialFolders = (folderRows ?? []).map((f) => {
    const r = byRegion.get(f.region_id);
    return {
      id: f.id,
      regionId: f.region_id,
      pathSegment: f.path_segment,
      createdAt: f.created_at,
      regionName: r?.name ?? "—",
      regionCode: r?.code ?? null,
    };
  });

  return (
    <div className="space-y-5 pb-10">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:text-zinc-900">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-zinc-900">Employee files</span>
      </nav>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Employee files</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use the workspace below to turn on storage per region, then browse Wasabi the same way employees see it: pick a
          region, open someone&apos;s folder, go to dates or custom folders, and upload or tidy files on their behalf.
        </p>
      </div>
      <EmployeeFilesClient regions={regions ?? []} initialFolders={initialFolders} />
    </div>
  );
}
