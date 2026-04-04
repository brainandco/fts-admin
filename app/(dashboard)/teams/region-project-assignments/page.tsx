import { getDataClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TeamRegionProjectAssignmentsClient } from "@/components/teams/TeamRegionProjectAssignmentsClient";

export default async function TeamRegionProjectAssignmentsPage() {
  const { profile } = await getCurrentUserProfile();
  if (!profile?.is_super_user) redirect("/teams");

  const supabase = await getDataClient();
  const { data: teams } = await supabase.from("teams").select("id, name, team_code, region_id, project_id").order("name");
  const { data: regions } = await supabase.from("regions").select("id, name").order("name");
  const { data: projects } = await supabase.from("projects").select("id, name, region_id").order("name");

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/teams" className="hover:text-zinc-900">
          Teams
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Region &amp; project assignments</span>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Team region &amp; project assignments</h1>
        <p className="mt-1 text-sm text-zinc-500">Super User only. Assign after the team is created.</p>
      </div>
      <TeamRegionProjectAssignmentsClient teams={teams ?? []} regions={regions ?? []} projects={projects ?? []} />
    </div>
  );
}
