import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { AdminEhsWhoHasClient } from "@/components/ehs/AdminEhsWhoHasClient";
import { loadTeamEhsAssignments } from "@/lib/assets/load-team-ehs-assignments";

export default async function EhsWhoHasPage() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    redirect("/dashboard");
  }

  const supabase = await getDataClient();
  const { profile } = await getCurrentUserProfile();
  const regionId = profile?.is_super_user ? null : profile?.region_id ?? null;

  const teams = await loadTeamEhsAssignments(supabase, { regionId });

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/ehs-tools" className="hover:text-zinc-900">
          EHS Tools
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Who has EHS tools</span>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Who has EHS tools</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Team-wise view: DT wear tools and Driver/Rigger wear tools per team.
        </p>
      </div>
      <AdminEhsWhoHasClient teams={teams} />
    </div>
  );
}
