import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { AssetForm } from "@/components/assets/AssetForm";

export default async function NewAssetPage() {
  if (!(await can("assets.manage"))) redirect("/dashboard");
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Add tools / assets</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Add one tool at a time (type, serial, name). You must upload at least two intake photos per asset so returns can be
        compared to purchase condition. Counts by type and unassigned/assigned lists refresh on the Assets page.
      </p>
      <AssetForm existing={null} qcEmployees={[]} />
    </div>
  );
}
