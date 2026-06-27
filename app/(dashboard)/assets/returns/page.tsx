import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AssetReturnsQueue } from "@/components/assets/AssetReturnsQueue";

export default async function AssetReturnsPage() {
  if (!(await can("assets.manage")) && !(await can("assets.return"))) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/assets" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Assets
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900">Asset return queue</h1>
      </div>
      <p className="max-w-3xl text-sm text-zinc-600">
        Employees submit returns with a comment. Regular employee returns are confirmed by the Project Manager in the
        Employee Portal. Returns from Project Managers are confirmed here by Admin (no GM step). When an asset was sent to
        maintenance and is fixed, an admin with asset management permission can mark it back in pool from the list below
        or from the asset detail page.
      </p>
      <AssetReturnsQueue canClearMaintenance={await can("assets.manage")} />
    </div>
  );
}
