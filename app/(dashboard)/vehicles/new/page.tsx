import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/permissions";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default async function NewVehiclePage() {
  if (!(await can("vehicles.manage"))) redirect("/dashboard");
  const supabase = await createServerSupabaseClient();
  const { data: regions } = await supabase.from("regions").select("id, name").order("name");
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Add vehicle</h1>
      <p className="mb-4 text-sm text-zinc-600">
        Add the vehicle to the database first. At least two condition photos are required (intake / purchase state). You can assign
        it to an employee later from the vehicle&apos;s edit page.
      </p>
      <VehicleForm existing={null} regions={regions ?? []} projects={projects ?? []} />
    </div>
  );
}
