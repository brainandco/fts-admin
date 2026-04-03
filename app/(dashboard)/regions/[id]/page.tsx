import { getDataClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RegionForm } from "@/components/regions/RegionForm";
import { EntityHistory } from "@/components/audit/EntityHistory";

export default async function RegionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getDataClient();
  const { data: region } = await supabase.from("regions").select("*").eq("id", id).single();
  if (!region) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/regions" className="text-sm text-zinc-500 hover:text-zinc-900">← Regions</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{region.name}</h1>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Edit region</h2>
        <RegionForm existing={{ id: region.id, name: region.name, code: region.code }} />
      </section>

      <EntityHistory entityType="region" entityId={id} />
    </div>
  );
}
