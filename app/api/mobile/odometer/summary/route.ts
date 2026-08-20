import { NextResponse } from "next/server";
import { buildDailySummaries, type OdometerReadingRow } from "@/lib/odometer/daily-summary";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** GET — odometer / duty summaries for Admin Lite mobile. */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("vehicles.manage") || ctx.permissions.has("vehicles.assign"))) {
    return NextResponse.json({ message: "You do not have access to odometer data." }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const today = new Date().toISOString().slice(0, 10);
  const focusDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const supabase = await getDataClient();
  const [{ data: readings }, { data: openShifts }] = await Promise.all([
    supabase
      .from("vehicle_odometer_readings")
      .select(
        "vehicle_id, employee_id, team_id, reading_date, slot, captured_at, lat, lng, accuracy_m, location_label, activity_notes, plate_number_final, odometer_km_final, plate_photo_url, odometer_photo_urls, ocr_status, duty_shift_id"
      )
      .gte("reading_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("captured_at", { ascending: false })
      .limit(4000),
    supabase
      .from("vehicle_duty_shifts")
      .select("id, vehicle_id, employee_id, shift_date, started_at, start_km, status")
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  const { data: employees } = await supabase.from("employees").select("id, full_name, region_id");
  const { data: regions } = await supabase.from("regions").select("id, name");
  const { data: vehicles } = await supabase.from("vehicles").select("id, plate_number, make, model");
  const { data: teams } = await supabase.from("teams").select("id, name");

  const empMap = new Map(
    (employees ?? []).map((e) => [
      e.id,
      {
        full_name: e.full_name as string,
        region_name: (regions ?? []).find((r) => r.id === e.region_id)?.name ?? "",
        team_name: "",
      },
    ])
  );
  for (const t of teams ?? []) {
    /* team names filled via reading team_id below if needed */
    void t;
  }
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t.name as string]));
  const vehicleMap = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      { make: (v.make as string) ?? "", model: (v.model as string) ?? "", plate: (v.plate_number as string) ?? "" },
    ])
  );

  const people = new Map(
    [...empMap.entries()].map(([id, p]) => [
      id,
      { full_name: p.full_name, region_name: p.region_name, team_name: p.team_name },
    ])
  );
  for (const row of readings ?? []) {
    if (!row.team_id) continue;
    const person = people.get(row.employee_id);
    if (person && !person.team_name) {
      person.team_name = teamMap.get(row.team_id) ?? "";
    }
  }

  const vehiclesForSummary = new Map(
    [...vehicleMap.entries()].map(([id, v]) => [id, { make: v.make, model: v.model }])
  );

  const summaries = buildDailySummaries(
    (readings ?? []) as OdometerReadingRow[],
    people,
    vehiclesForSummary
  ).filter((s) => s.reading_date === focusDate);

  const openItems = (openShifts ?? []).map((s) => {
    const emp = empMap.get(s.employee_id);
    const vehicle = vehicleMap.get(s.vehicle_id);
    return {
      id: s.id,
      plate: vehicle?.plate ?? null,
      driverName: emp?.full_name ?? null,
      regionName: emp?.region_name || null,
      startedAt: s.started_at,
      startKm: s.start_km ?? null,
      shiftDate: s.shift_date,
    };
  });

  return NextResponse.json({
    date: focusDate,
    openCount: openItems.length,
    openShifts: openItems,
    completeCount: summaries.filter((s) => s.status === "Complete").length,
    onDutyCount: summaries.filter((s) => s.status === "On duty" || s.status === "Start only").length,
    summaries: summaries.slice(0, 100).map((s) => ({
      vehicleId: s.vehicle_id,
      employeeId: s.employee_id,
      readingDate: s.reading_date,
      plate: s.plate,
      driver: s.driver,
      region: s.region,
      team: s.team,
      vehicleLabel: s.vehicleLabel,
      startKm: s.morningKm,
      startAt: s.morningAt,
      startNotes: s.morningNotes,
      endKm: s.eveningKm,
      endAt: s.eveningAt,
      endNotes: s.eveningNotes,
      todayKm: s.todayKm,
      status: s.status,
    })),
  });
}
