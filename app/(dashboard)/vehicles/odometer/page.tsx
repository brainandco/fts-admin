import { redirect } from "next/navigation";
import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { OdometerTrackingTable } from "@/components/vehicles/OdometerTrackingTable";
import { OdometerDriverStatusTable } from "@/components/vehicles/OdometerDriverStatusTable";
import {
  buildDailySummaries,
  type DailyOdoPerson,
  type DailyOdoVehicle,
  type OdometerReadingRow,
} from "@/lib/odometer/daily-summary";

export default async function OdometerTrackingPage() {
  const canManage = await can("vehicles.manage");
  const canAssign = await can("vehicles.assign");
  if (!canManage && !canAssign) redirect("/dashboard");

  const supabase = await getDataClient();
  const { data: rawRows } = await supabase
    .from("vehicle_odometer_readings")
    .select(
      "vehicle_id, employee_id, team_id, reading_date, slot, captured_at, lat, lng, accuracy_m, plate_number_final, odometer_km_final, plate_photo_url, odometer_photo_urls, ocr_status"
    )
    .order("reading_date", { ascending: false })
    .limit(8000);

  const readings: OdometerReadingRow[] = (rawRows ?? []).map((row) => ({
    vehicle_id: String(row.vehicle_id),
    employee_id: String(row.employee_id),
    team_id: (row.team_id as string | null) ?? null,
    reading_date: String(row.reading_date),
    slot: row.slot === "evening" ? "evening" : "morning",
    captured_at: String(row.captured_at),
    lat: typeof row.lat === "number" ? row.lat : row.lat != null ? Number(row.lat) : null,
    lng: typeof row.lng === "number" ? row.lng : row.lng != null ? Number(row.lng) : null,
    accuracy_m: typeof row.accuracy_m === "number" ? row.accuracy_m : null,
    plate_number_final: String(row.plate_number_final ?? ""),
    odometer_km_final: Number(row.odometer_km_final) || 0,
    plate_photo_url: String(row.plate_photo_url ?? ""),
    odometer_photo_urls: row.odometer_photo_urls,
    ocr_status: String(row.ocr_status ?? ""),
  }));

  const employeeIds = [...new Set(readings.map((r) => r.employee_id))];
  const vehicleIds = [...new Set(readings.map((r) => r.vehicle_id))];
  const teamIds = [...new Set(readings.map((r) => r.team_id).filter(Boolean) as string[])];

  const [{ data: employees }, { data: vehicleRows }, { data: teams }] = await Promise.all([
    employeeIds.length
      ? supabase.from("employees").select("id, full_name, region_id").in("id", employeeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; region_id: string | null }> }),
    vehicleIds.length
      ? supabase.from("vehicles").select("id, make, model").in("id", vehicleIds)
      : Promise.resolve({ data: [] as Array<{ id: string; make: string | null; model: string | null }> }),
    teamIds.length
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const regionIds = [...new Set((employees ?? []).map((e) => e.region_id).filter(Boolean) as string[])];
  const { data: regions } = regionIds.length
    ? await supabase.from("regions").select("id, name").in("id", regionIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name ?? ""]));
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t.name ?? ""]));

  const people = new Map<string, DailyOdoPerson>();
  for (const e of employees ?? []) {
    people.set(e.id, {
      full_name: e.full_name ?? "",
      region_name: e.region_id ? regionMap.get(e.region_id) ?? "" : "",
      team_name: "",
    });
  }
  for (const r of readings) {
    if (!r.team_id) continue;
    const p = people.get(r.employee_id);
    if (p && !p.team_name) p.team_name = teamMap.get(r.team_id) ?? "";
  }

  const vehicles = new Map<string, DailyOdoVehicle>();
  for (const v of vehicleRows ?? []) {
    vehicles.set(v.id, { make: v.make ?? "", model: v.model ?? "" });
  }

  const summaries = buildDailySummaries(readings, people, vehicles);

  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  const { data: driverRoles } = await supabase
    .from("employee_roles")
    .select("employee_id")
    .eq("role", "Driver/Rigger");
  const driverIds = [...new Set((driverRoles ?? []).map((r) => r.employee_id as string))];
  const { data: drivers } = driverIds.length
    ? await supabase
        .from("employees")
        .select("id, full_name, region_id, status")
        .in("id", driverIds)
        .neq("status", "Terminated")
    : { data: [] };
  const driverList = drivers ?? [];
  const driverRegionIds = [...new Set(driverList.map((e) => e.region_id).filter(Boolean) as string[])];
  const { data: driverRegions } = driverRegionIds.length
    ? await supabase.from("regions").select("id, name").in("id", driverRegionIds)
    : { data: [] };
  const driverRegionMap = new Map((driverRegions ?? []).map((r) => [r.id, r.name ?? ""]));
  const { data: driverAssign } = driverIds.length
    ? await supabase.from("vehicle_assignments").select("employee_id, vehicle_id").in("employee_id", driverIds)
    : { data: [] };
  const assignByEmp = new Map((driverAssign ?? []).map((a) => [a.employee_id as string, a.vehicle_id as string]));
  const assignedVehicleIds = [...new Set((driverAssign ?? []).map((a) => a.vehicle_id as string))];
  const { data: assignedVehicles } = assignedVehicleIds.length
    ? await supabase.from("vehicles").select("id, plate_number").in("id", assignedVehicleIds)
    : { data: [] };
  const plateByVehicle = new Map((assignedVehicles ?? []).map((v) => [v.id, v.plate_number ?? ""]));
  type TodaySlotRow = {
    vehicle_id: string;
    employee_id: string;
    slot: string;
    captured_at: string;
    odometer_km_final: number;
  };
  const { data: todaySlotsData } = assignedVehicleIds.length
    ? await supabase
        .from("vehicle_odometer_readings")
        .select("vehicle_id, employee_id, slot, captured_at, odometer_km_final")
        .in("vehicle_id", assignedVehicleIds)
        .eq("reading_date", todayIso)
    : { data: [] as TodaySlotRow[] };
  const todaySlots: TodaySlotRow[] = (todaySlotsData ?? []).map((s) => ({
    vehicle_id: String(s.vehicle_id),
    employee_id: String(s.employee_id),
    slot: String(s.slot),
    captured_at: String(s.captured_at),
    odometer_km_final: Number(s.odometer_km_final) || 0,
  }));
  const submitterIds = [...new Set(todaySlots.map((s) => s.employee_id))];
  const { data: submitters } = submitterIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", submitterIds)
    : { data: [] };
  const submitterName = new Map((submitters ?? []).map((e) => [e.id, e.full_name ?? ""]));
  const slotMap = new Map<string, { morning?: TodaySlotRow; evening?: TodaySlotRow }>();
  for (const s of todaySlots) {
    const cur = slotMap.get(s.vehicle_id) ?? {};
    if (s.slot === "morning") cur.morning = s;
    if (s.slot === "evening") cur.evening = s;
    slotMap.set(s.vehicle_id, cur);
  }

  const driverStatusRows = driverList
    .map((d) => {
      const vehicleId = assignByEmp.get(d.id) ?? null;
      const slots = vehicleId ? slotMap.get(vehicleId) : undefined;
      const m = slots?.morning;
      const e = slots?.evening;
      return {
        employeeId: d.id,
        name: d.full_name ?? "—",
        region: d.region_id ? driverRegionMap.get(d.region_id) ?? "" : "",
        plate: vehicleId ? plateByVehicle.get(vehicleId) ?? null : null,
        vehicleId,
        morning: {
          submitted: !!m,
          at: m ? String(m.captured_at) : null,
          byName: m ? submitterName.get(m.employee_id) ?? null : null,
          km: m ? Number(m.odometer_km_final) : null,
        },
        evening: {
          submitted: !!e,
          at: e ? String(e.captured_at) : null,
          byName: e ? submitterName.get(e.employee_id) ?? null : null,
          km: e ? Number(e.odometer_km_final) : null,
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Odometer tracking</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Every morning and evening reading is kept in the database. Same-day km is evening minus morning. vs previous
          day is that day’s total minus the last logged day’s total. The Google Sheet <strong>Today</strong> tab shows
          only the current date; <strong>History</strong> keeps every day.
        </p>
      </div>
      <OdometerDriverStatusTable date={todayIso} rows={driverStatusRows} />
      <OdometerTrackingTable rows={summaries} />
    </div>
  );
}
