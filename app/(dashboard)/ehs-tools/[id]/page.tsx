import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { can } from "@/lib/rbac/permissions";
import { EhsToolForm } from "@/components/ehs/EhsToolForm";
import { ConditionPhotosGallery } from "@/components/assets/ConditionPhotosGallery";

export default async function EhsToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage"))) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).eq("is_ehs_tool", true).maybeSingle();
  if (!asset) notFound();

  let assigneeName: string | null = null;
  let driverName: string | null = null;
  if (asset.assigned_to_employee_id) {
    const { data: dt } = await supabase
      .from("employees")
      .select("full_name")
      .eq("id", asset.assigned_to_employee_id)
      .maybeSingle();
    assigneeName = dt?.full_name ?? null;
  }
  if (asset.ehs_for_employee_id) {
    const { data: driver } = await supabase
      .from("employees")
      .select("full_name")
      .eq("id", asset.ehs_for_employee_id)
      .maybeSingle();
    driverName = driver?.full_name ?? null;
  }

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/ehs-tools" className="hover:text-zinc-900">
          EHS Tools
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">{asset.asset_id}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900">{asset.name}</h1>
        <span className="rounded bg-orange-100 px-2 py-0.5 text-sm text-orange-900">{asset.status}</span>
        <span className="font-mono text-sm text-zinc-600">{asset.asset_id}</span>
        <span className="text-sm text-zinc-500">EN: {asset.en_code}</span>
      </div>

      {assigneeName ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-zinc-700">
          Assigned to DT: <strong>{assigneeName}</strong>
          {asset.ehs_wear_role === "driver_rigger" && driverName ? (
            <>
              {" "}
              · Worn by Driver/Rigger: <strong>{driverName}</strong>
            </>
          ) : null}
        </div>
      ) : null}

      <ConditionPhotosGallery title="Intake / purchase condition photos" urls={asset.purchase_image_urls as string[] | undefined} />

      <EhsToolForm
        existing={{
          id: asset.id,
          asset_id: asset.asset_id,
          name: asset.name,
          category: asset.category,
          condition: asset.condition,
          status: asset.status,
          ehs_tool_type: asset.ehs_tool_type,
          en_code: asset.en_code,
          purchase_image_urls: asset.purchase_image_urls,
        }}
      />
    </div>
  );
}
