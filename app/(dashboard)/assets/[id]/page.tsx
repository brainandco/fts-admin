import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AssetForm } from "@/components/assets/AssetForm";
import { EntityHistory } from "@/components/audit/EntityHistory";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", id).single();
  if (!asset) notFound();
  const { data: history } = await supabase
    .from("asset_assignment_history")
    .select("id, to_employee_id, assigned_by_user_id, assigned_at, notes")
    .eq("asset_id", id)
    .order("assigned_at", { ascending: false });
  const historyList = history ?? [];
  const employeeIds = [...new Set(historyList.map((h) => h.to_employee_id))];
  const userIds = [...new Set(historyList.map((h) => h.assigned_by_user_id).filter(Boolean) as string[])];
  const { data: empRows } = await supabase.from("employees").select("id, full_name").in("id", employeeIds);
  const { data: userRows } = await supabase.from("users_profile").select("id, full_name, email").in("id", userIds);
  const empMap = new Map((empRows ?? []).map((e) => [e.id, e.full_name]));
  const userMap = new Map((userRows ?? []).map((u) => [u.id, u.full_name || u.email]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/assets" className="text-sm text-zinc-500 hover:text-zinc-900">← Assets</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{asset.name}</h1>
        <span className="rounded bg-zinc-200 px-2 py-0.5 text-sm text-zinc-700">{asset.status}</span>
        {asset.serial && <span className="text-sm text-zinc-500">Serial: {asset.serial}</span>}
        {asset.model && <span className="text-sm text-zinc-500">Model: {asset.model}</span>}
        {asset.imei_1 && <span className="text-sm font-mono text-zinc-500">IMEI 1: {asset.imei_1}</span>}
        {asset.imei_2 && <span className="text-sm font-mono text-zinc-500">IMEI 2: {asset.imei_2}</span>}
      </div>
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Edit asset</h2>
        <AssetForm existing={asset} />
      </section>
      {historyList.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Assignment history</h2>
          <p className="mb-3 text-sm text-zinc-500">Track who received this asset and who assigned it.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Assigned to (employee)</th>
                  <th className="pb-2 pr-4">Assigned by (user)</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((h) => (
                  <tr key={h.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">{new Date(h.assigned_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{empMap.get(h.to_employee_id) ?? h.to_employee_id}</td>
                    <td className="py-2 pr-4">{h.assigned_by_user_id ? userMap.get(h.assigned_by_user_id) ?? "—" : "—"}</td>
                    <td className="py-2">{h.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <EntityHistory entityType="asset" entityId={id} />
    </div>
  );
}
