import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { VehicleDeleteButton } from "@/components/vehicles/VehicleDeleteButton";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { VehicleMaintenance } from "@/components/vehicles/VehicleMaintenance";
import { AdminRegionEmployeeAssignCard } from "@/components/admin-assignment/AdminRegionEmployeeAssignCard";
import { can } from "@/lib/rbac/permissions";
import { ConditionPhotosGallery } from "@/components/assets/ConditionPhotosGallery";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const canManage = await can("vehicles.manage");
  const canAssign = await can("vehicles.assign");
  if (!canManage && !canAssign) redirect("/dashboard");

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
  const { data: returnEvents } = await supabase
    .from("vehicle_return_events")
    .select("id, employee_comment, return_image_urls, created_at, from_employee_id")
    .eq("vehicle_id", id)
    .order("created_at", { ascending: false });
  const retEmpIds = [...new Set((returnEvents ?? []).map((r) => r.from_employee_id))];
  const { data: retEmps } = retEmpIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", retEmpIds)
    : { data: [] };
  const retEmpMap = new Map((retEmps ?? []).map((e) => [e.id, e.full_name ?? ""]));

  const label = assignee?.full_name?.trim() || vehicle.plate_number || "Vehicle";
  const canAssignVehicle = canManage || canAssign;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/vehicles" className="text-sm text-zinc-500 hover:text-zinc-900">← Vehicles</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{label}</h1>
        <span className={`rounded px-2 py-0.5 text-sm font-medium ${vehicle.status === "Assigned" ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`}>
          {vehicle.status}
        </span>
        {canManage ? <VehicleDeleteButton vehicleId={id} label={label} /> : null}
      </div>
      <AdminRegionEmployeeAssignCard
        variant="vehicle"
        resourceId={id}
        regions={regions ?? []}
        initialRegionId={(vehicle as { assigned_region_id?: string | null }).assigned_region_id ?? null}
        statusLabel={vehicle.status}
        canAssign={canAssignVehicle}
      />
      <ConditionPhotosGallery
        title="Intake / purchase condition photos"
        urls={(vehicle as { purchase_image_urls?: unknown }).purchase_image_urls as string[] | undefined}
      />
      {(returnEvents ?? []).length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-900">Return hand-in photos (drivers)</h2>
          <p className="text-sm text-zinc-600">Photos submitted when a driver returned this vehicle to the pool.</p>
          {(returnEvents ?? []).map((ev) => (
            <div key={ev.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">
                {new Date(ev.created_at).toLocaleString()} · {retEmpMap.get(ev.from_employee_id) ?? ev.from_employee_id}
              </p>
              <p className="mt-2 text-sm text-zinc-800">{ev.employee_comment}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {parseImageUrlArray(ev.return_image_urls).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-24 w-24 overflow-hidden rounded border border-zinc-200 bg-zinc-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Vehicle details</h2>
        {canManage ? (
          <VehicleForm existing={vehicle} regions={regions ?? []} projects={projects ?? []} />
        ) : (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            You can assign or unassign this vehicle from the assignment section on this page. Editing plate, photos, and
            maintenance requires{" "}
            <strong>Manage vehicles</strong>.
          </p>
        )}
      </section>
      {canManage ? <VehicleMaintenance vehicleId={id} logs={maintenance ?? []} /> : null}
      <EntityHistory entityType="vehicle" entityId={id} />
    </div>
  );
}
