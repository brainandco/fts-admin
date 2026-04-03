import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { RegionForm } from "@/components/regions/RegionForm";

export default async function NewRegionPage() {
  if (!(await can("regions.manage"))) redirect("/dashboard");
  const supabase = await createServerSupabaseClient();
  const { data: regions } = await supabase.from("regions").select("id, name, code");
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">New region</h1>
      <RegionForm existing={null} />
    </div>
  );
}
