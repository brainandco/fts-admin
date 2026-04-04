import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { VehicleDeleteButton } from "@/components/vehicles/VehicleDeleteButton";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { VehicleMaintenance } from "@/components/vehicles/VehicleMaintenance";
import { AdminRegionTeamAssignCard } from "@/components/admin-assignment/AdminRegionTeamAssignCard";
import { can } from "@/lib/rbac/permissions";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!vehicle) notFound();
  const { data: assignment } = await supabase.from("vehicle_assignments").select("employee_id").eq("vehicle_id", id).maybeSingle();
  const { data: assignee } = assignment
    ? await supabase.from("employees").select("full_name").eq("id", assignment.employee_id).single()
    : { data: null };
  const { data: regions } = await supabase.from("regions").select("id, name").order("name");
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");
  const { data: maintenance } = await supabase.from("vehicle_maintenance").select("*").eq("vehicle_id", id).order("service_date", { ascending: false });

  const label = assignee?.full_name?.trim() || vehicle.plate_number || "Vehicle";
  const canAssignVehicle = await can("vehicles.manage");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/vehicles" className="text-sm text-zinc-500 hover:text-zinc-900">← Vehicles</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{label}</h1>
        <span className={`rounded px-2 py-0.5 text-sm font-medium ${vehicle.status === "Assigned" ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`}>
          {vehicle.status}
        </span>
        <VehicleDeleteButton vehicleId={id} label={label} />
      </div>
      <AdminRegionTeamAssignCard
        variant="vehicle"
        resourceId={id}
        regions={regions ?? []}
        initialRegionId={(vehicle as { assigned_region_id?: string | null }).assigned_region_id ?? null}
        statusLabel={vehicle.status}
        canAssign={canAssignVehicle}
      />
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Vehicle details</h2>
        <VehicleForm existing={vehicle} regions={regions ?? []} projects={projects ?? []} />
      </section>
      <VehicleMaintenance vehicleId={id} logs={maintenance ?? []} />
      <EntityHistory entityType="vehicle" entityId={id} />
    </div>
  );
}
