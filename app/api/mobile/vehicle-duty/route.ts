import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** GET — recent vehicle duty activity feed (Admin Lite mobile, read-only). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("vehicles.manage") || ctx.permissions.has("vehicles.assign"))) {
    return NextResponse.json({ message: "You do not have access to vehicle duty." }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = parseInt(url.searchParams.get("limit") ?? "30", 10);
  const limit = Number.isFinite(raw) ? Math.min(50, Math.max(1, raw)) : 30;

  const supabase = await getDataClient();
  const [{ data: openShifts }, { data: recentShifts }] = await Promise.all([
    supabase
      .from("vehicle_duty_shifts")
      .select("id, vehicle_id, employee_id, shift_date, started_at, ended_at, start_km, end_km, status")
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("vehicle_duty_shifts")
      .select("id, vehicle_id, employee_id, shift_date, started_at, ended_at, start_km, end_km, status")
      .order("started_at", { ascending: false })
      .limit(limit),
  ]);

  const vehicleIds = [...new Set([...(openShifts ?? []), ...(recentShifts ?? [])].map((s) => s.vehicle_id))];
  const employeeIds = [...new Set([...(openShifts ?? []), ...(recentShifts ?? [])].map((s) => s.employee_id))];

  const [{ data: vehicles }, { data: employees }] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, plate_number, make, model").in("id", vehicleIds)
      : { data: [] },
    employeeIds.length
      ? supabase.from("employees").select("id, full_name").in("id", employeeIds)
      : { data: [] },
  ]);

  const vehicleMap = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  function mapShift(s: {
    id: string;
    vehicle_id: string;
    employee_id: string;
    shift_date: string;
    started_at: string;
    ended_at: string | null;
    start_km: number | null;
    end_km: number | null;
    status: string;
  }) {
    const vehicle = vehicleMap.get(s.vehicle_id);
    return {
      id: s.id,
      status: s.status,
      shiftDate: s.shift_date,
      startedAt: s.started_at,
      endedAt: s.ended_at ?? null,
      startKm: s.start_km ?? null,
      endKm: s.end_km ?? null,
      plateNumber: vehicle?.plate_number ?? null,
      vehicleLabel: [vehicle?.plate_number, vehicle?.make, vehicle?.model].filter(Boolean).join(" · ") || null,
      driverName: employeeMap.get(s.employee_id) ?? null,
    };
  }

  return NextResponse.json({
    openCount: openShifts?.length ?? 0,
    openShifts: (openShifts ?? []).map(mapShift),
    recentShifts: (recentShifts ?? []).map(mapShift),
  });
}
