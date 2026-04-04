import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { SimForm } from "@/components/sims/SimForm";
import { AdminRegionTeamAssignCard } from "@/components/admin-assignment/AdminRegionTeamAssignCard";

export default async function SimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) redirect("/dashboard");
  const { id } = await params;
  const supabase = await getDataClient();
  const { data: sim } = await supabase.from("sim_cards").select("*").eq("id", id).single();
  if (!sim) notFound();

  const { data: regions } = await supabase.from("regions").select("id, name").order("name");

  const assignedEmployee = sim.assigned_to_employee_id
    ? await supabase.from("employees").select("full_name").eq("id", sim.assigned_to_employee_id).maybeSingle()
    : { data: null };

  const canAssign = (await can("assets.manage")) || (await can("assets.assign"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/sims" className="text-sm text-zinc-500 hover:text-zinc-900">← SIM cards</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{sim.sim_number}</h1>
        <span className="rounded bg-zinc-200 px-2 py-0.5 text-sm text-zinc-700">{sim.status}</span>
      </div>

      {sim.status === "Assigned" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          <p><span className="font-medium">Assigned to:</span> {assignedEmployee.data?.full_name ?? "—"}</p>
        </div>
      ) : null}

      <AdminRegionTeamAssignCard
        variant="sim"
        resourceId={id}
        regions={regions ?? []}
        initialRegionId={null}
        statusLabel={sim.status}
        canAssign={canAssign}
      />

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Edit SIM card</h2>
        <SimForm existing={sim} />
      </section>
    </div>
  );
}
