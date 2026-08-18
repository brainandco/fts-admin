import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import { ExportsCenter } from "@/components/exports/ExportsCenter";

export default async function ExportsPage() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const isAdmin = await can("approvals.approve");
  if (!isSuper && !isAdmin) redirect("/dashboard");

  const supabase = await getDataClient();
  const [{ data: regions }, { data: projects }] = await Promise.all([
    supabase.from("regions").select("id, name").order("name"),
    supabase.from("projects").select("id, name, region_id").order("name"),
  ]);

  return (
    <ExportsCenter
      regions={(regions ?? []).map((r) => ({ id: r.id as string, name: (r.name as string) || "—" }))}
      projects={(projects ?? []).map((p) => ({
        id: p.id as string,
        name: (p.name as string) || "—",
        region_id: p.region_id as string,
      }))}
    />
  );
}
