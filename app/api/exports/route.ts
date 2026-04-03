import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  return lines.join("\n");
}

function filenameFor(dataset: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${dataset}_${stamp}.csv`;
}

type ProfileRow = { id: string; full_name: string | null; email: string | null };

function profileLabel(p: ProfileRow): string {
  return (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "";
}

async function resolveUserDisplayMap(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map<string, string>();

  const { data: profiles } = await supabase.from("users_profile").select("id, full_name, email").in("id", ids);
  const missingNameEmails = [...new Set((profiles ?? [])
    .filter((p) => !(p.full_name && p.full_name.trim()) && p.email)
    .map((p) => p.email as string))];
  const { data: employeeNames } = missingNameEmails.length
    ? await supabase.from("employees").select("email, full_name").in("email", missingNameEmails)
    : { data: [] };

  const employeeByEmail = new Map(
    (employeeNames ?? []).map((e) => [String(e.email || "").trim().toLowerCase(), e.full_name || ""])
  );
  return new Map(
    (profiles ?? []).map((p) => {
      const emailKey = String(p.email || "").trim().toLowerCase();
      const fromEmployee = emailKey ? employeeByEmail.get(emailKey) : "";
      return [p.id, (fromEmployee && fromEmployee.trim()) || profileLabel(p as ProfileRow)];
    })
  );
}

export async function GET(req: Request) {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const isAdmin = await can("approvals.approve");
  if (!isSuper && !isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const dataset = (url.searchParams.get("dataset") || "").trim();
  if (!dataset) return NextResponse.json({ message: "dataset is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  let rows: Record<string, unknown>[] = [];

  if (dataset === "assets_master") {
    const { data: assets } = await supabase
      .from("assets")
      .select(
        "asset_id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id, assigned_region_id, assigned_project_id, assigned_by, assigned_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    const empIds = [...new Set((assets ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean) as string[])];
    const actorUserIds = [...new Set((assets ?? []).map((a) => a.assigned_by).filter(Boolean) as string[])];
    const regionIds = [...new Set((assets ?? []).map((a) => a.assigned_region_id).filter(Boolean) as string[])];
    const projectIds = [...new Set((assets ?? []).map((a) => a.assigned_project_id).filter(Boolean) as string[])];
    const { data: emps } = empIds.length ? await supabase.from("employees").select("id, full_name").in("id", empIds) : { data: [] };
    const { data: regions } = regionIds.length ? await supabase.from("regions").select("id, name").in("id", regionIds) : { data: [] };
    const { data: projects } = projectIds.length ? await supabase.from("projects").select("id, name").in("id", projectIds) : { data: [] };
    const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
    const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
    const actorMap = await resolveUserDisplayMap(supabase, actorUserIds);
    rows = (assets ?? []).map((a) => ({
      asset_code: a.asset_id,
      name: a.name,
      category: a.category,
      model: a.model,
      serial: a.serial,
      imei_1: a.imei_1,
      imei_2: a.imei_2,
      status: a.status,
      assigned_employee_name: a.assigned_to_employee_id ? empMap.get(a.assigned_to_employee_id) ?? "" : "",
      assigned_region_name: a.assigned_region_id ? regionMap.get(a.assigned_region_id) ?? "" : "",
      assigned_project_name: a.assigned_project_id ? projectMap.get(a.assigned_project_id) ?? "" : "",
      assigned_by_name: a.assigned_by ? actorMap.get(a.assigned_by) ?? "" : "",
      assigned_at: a.assigned_at,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));
  } else if (dataset === "asset_assignment_history") {
    const { data } = await supabase
      .from("asset_assignment_history")
      .select("asset_id, to_employee_id, assigned_by_user_id, assigned_at, notes")
      .order("assigned_at", { ascending: false });
    const assetFkIds = [...new Set((data ?? []).map((r) => r.asset_id).filter(Boolean) as string[])];
    const employeeIds = [...new Set((data ?? []).map((r) => r.to_employee_id).filter(Boolean) as string[])];
    const actorUserIds = [...new Set((data ?? []).map((r) => r.assigned_by_user_id).filter(Boolean) as string[])];
    const { data: assetRows } = assetFkIds.length
      ? await supabase.from("assets").select("id, asset_id, name").in("id", assetFkIds)
      : { data: [] };
    const assetMap = new Map((assetRows ?? []).map((a) => [a.id, { code: a.asset_id, name: a.name }]));
    const { data: employees } = employeeIds.length
      ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
      : { data: [] };
    const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
    const actorMap = await resolveUserDisplayMap(supabase, actorUserIds);
    rows = (data ?? []).map((r) => {
      const a = r.asset_id ? assetMap.get(r.asset_id) : undefined;
      return {
        asset_code: a?.code ?? "",
        asset_name: a?.name ?? "",
        to_employee_name: r.to_employee_id ? empMap.get(r.to_employee_id) ?? "" : "",
        assigned_by_name: r.assigned_by_user_id ? actorMap.get(r.assigned_by_user_id) ?? "" : "",
        assigned_at: r.assigned_at,
        notes: r.notes,
      };
    });
  } else if (dataset === "asset_returns") {
    const { data } = await supabase
      .from("asset_return_requests")
      .select("asset_id, from_employee_id, region_id, employee_comment, status, pm_decision, pm_comment, processed_at, created_at")
      .order("created_at", { ascending: false });
    const assetFkIds = [...new Set((data ?? []).map((r) => r.asset_id).filter(Boolean) as string[])];
    const employeeIds = [...new Set((data ?? []).map((r) => r.from_employee_id).filter(Boolean) as string[])];
    const regionIds = [...new Set((data ?? []).map((r) => r.region_id).filter(Boolean) as string[])];
    const { data: assetRows } = assetFkIds.length
      ? await supabase.from("assets").select("id, asset_id, name").in("id", assetFkIds)
      : { data: [] };
    const assetMap = new Map((assetRows ?? []).map((a) => [a.id, { code: a.asset_id, name: a.name }]));
    const { data: employees } = employeeIds.length
      ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
      : { data: [] };
    const { data: regions } = regionIds.length
      ? await supabase.from("regions").select("id, name").in("id", regionIds)
      : { data: [] };
    const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
    const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
    rows = (data ?? []).map((r) => {
      const a = r.asset_id ? assetMap.get(r.asset_id) : undefined;
      return {
        asset_code: a?.code ?? "",
        asset_name: a?.name ?? "",
        from_employee_name: r.from_employee_id ? empMap.get(r.from_employee_id) ?? "" : "",
        region_name: r.region_id ? regionMap.get(r.region_id) ?? "" : "",
        employee_comment: r.employee_comment,
        status: r.status,
        pm_decision: r.pm_decision,
        pm_comment: r.pm_comment,
        processed_at: r.processed_at,
        created_at: r.created_at,
      };
    });
  } else if (dataset === "sims_master") {
    const { data: sims } = await supabase
      .from("sim_cards")
      .select(
        "operator, service_type, sim_number, phone_number, status, assigned_to_employee_id, assigned_by_user_id, assigned_at, notes, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    const empIds = [...new Set((sims ?? []).map((s) => s.assigned_to_employee_id).filter(Boolean) as string[])];
    const actorUserIds = [...new Set((sims ?? []).map((s) => s.assigned_by_user_id).filter(Boolean) as string[])];
    const { data: emps } = empIds.length ? await supabase.from("employees").select("id, full_name").in("id", empIds) : { data: [] };
    const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    const actorMap = await resolveUserDisplayMap(supabase, actorUserIds);
    rows = (sims ?? []).map((s) => ({
      operator: s.operator,
      service_type: s.service_type,
      sim_number: s.sim_number,
      phone_number: s.phone_number,
      status: s.status,
      assigned_employee_name: s.assigned_to_employee_id ? empMap.get(s.assigned_to_employee_id) ?? "" : "",
      assigned_by_name: s.assigned_by_user_id ? actorMap.get(s.assigned_by_user_id) ?? "" : "",
      assigned_at: s.assigned_at,
      notes: s.notes,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  } else if (dataset === "sim_assignment_history") {
    const { data } = await supabase
      .from("sim_assignment_history")
      .select("sim_card_id, to_employee_id, assigned_by_user_id, assigned_at, unassigned_at, notes")
      .order("assigned_at", { ascending: false });
    const simIds = [...new Set((data ?? []).map((r) => r.sim_card_id).filter(Boolean) as string[])];
    const employeeIds = [...new Set((data ?? []).map((r) => r.to_employee_id).filter(Boolean) as string[])];
    const actorUserIds = [...new Set((data ?? []).map((r) => r.assigned_by_user_id).filter(Boolean) as string[])];
    const { data: simRows } = simIds.length
      ? await supabase.from("sim_cards").select("id, sim_number, operator").in("id", simIds)
      : { data: [] };
    const simMap = new Map((simRows ?? []).map((s) => [s.id, { sim_number: s.sim_number, operator: s.operator }]));
    const { data: employees } = employeeIds.length
      ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
      : { data: [] };
    const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
    const actorMap = await resolveUserDisplayMap(supabase, actorUserIds);
    rows = (data ?? []).map((r) => {
      const sim = r.sim_card_id ? simMap.get(r.sim_card_id) : undefined;
      return {
        sim_number: sim?.sim_number ?? "",
        operator: sim?.operator ?? "",
        to_employee_name: r.to_employee_id ? empMap.get(r.to_employee_id) ?? "" : "",
        assigned_by_name: r.assigned_by_user_id ? actorMap.get(r.assigned_by_user_id) ?? "" : "",
        assigned_at: r.assigned_at,
        unassigned_at: r.unassigned_at,
        notes: r.notes,
      };
    });
  } else if (dataset === "vehicles_master") {
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select(
        "id, plate_number, registration_number, make, model, year, vin, mileage, fuel_type, insurance_expiry, license_expiry, status, assigned_region_id, next_service_due_date, next_service_due_mileage, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    const vehicleIds = (vehicles ?? []).map((v) => v.id);
    const regionIds = [...new Set((vehicles ?? []).map((v) => v.assigned_region_id).filter(Boolean) as string[])];
    const { data: regions } = regionIds.length
      ? await supabase.from("regions").select("id, name").in("id", regionIds)
      : { data: [] };
    const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
    const { data: assigns } = vehicleIds.length
      ? await supabase.from("vehicle_assignments").select("vehicle_id, employee_id").in("vehicle_id", vehicleIds)
      : { data: [] };
    const empIds = [...new Set((assigns ?? []).map((a) => a.employee_id))];
    const { data: emps } = empIds.length ? await supabase.from("employees").select("id, full_name").in("id", empIds) : { data: [] };
    const assignMap = new Map((assigns ?? []).map((a) => [a.vehicle_id, a.employee_id]));
    const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    rows = (vehicles ?? []).map((v) => {
      const eid = assignMap.get(v.id);
      return {
        plate_number: v.plate_number,
        registration_number: v.registration_number,
        make: v.make,
        model: v.model,
        year: v.year,
        vin: v.vin,
        mileage: v.mileage,
        fuel_type: v.fuel_type,
        insurance_expiry: v.insurance_expiry,
        license_expiry: v.license_expiry,
        status: v.status,
        assigned_region_name: v.assigned_region_id ? regionMap.get(v.assigned_region_id) ?? "" : "",
        assigned_employee_name: eid ? empMap.get(eid) ?? "" : "",
        next_service_due_date: v.next_service_due_date,
        next_service_due_mileage: v.next_service_due_mileage,
        created_at: v.created_at,
        updated_at: v.updated_at,
      };
    });
  } else if (dataset === "vehicle_assignments") {
    const { data } = await supabase
      .from("vehicle_assignments")
      .select("vehicle_id, employee_id, assigned_at")
      .order("assigned_at", { ascending: false });
    const vehicleIds = [...new Set((data ?? []).map((r) => r.vehicle_id).filter(Boolean) as string[])];
    const empIds = [...new Set((data ?? []).map((r) => r.employee_id).filter(Boolean) as string[])];
    const { data: vehRows } = vehicleIds.length
      ? await supabase.from("vehicles").select("id, plate_number, make, model").in("id", vehicleIds)
      : { data: [] };
    const { data: emps } = empIds.length
      ? await supabase.from("employees").select("id, full_name").in("id", empIds)
      : { data: [] };
    const vmap = new Map((vehRows ?? []).map((v) => [v.id, v]));
    const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    rows = (data ?? []).map((r) => {
      const v = r.vehicle_id ? vmap.get(r.vehicle_id) : undefined;
      return {
        vehicle_plate: v?.plate_number ?? "",
        vehicle_make: v?.make ?? "",
        vehicle_model: v?.model ?? "",
        employee_name: r.employee_id ? empMap.get(r.employee_id) ?? "" : "",
        assigned_at: r.assigned_at,
      };
    });
  } else if (dataset === "transfer_requests") {
    const { data } = await supabase
      .from("transfer_requests")
      .select(
        "request_type, status, requester_employee_id, requester_region_id, target_employee_id, target_team_id, asset_id, request_reason, notes, payload_json, reviewed_by_employee_id, reviewer_comment, reviewed_at, created_at"
      )
      .order("created_at", { ascending: false });
    const requesterIds = [...new Set((data ?? []).map((r) => r.requester_employee_id).filter(Boolean) as string[])];
    const targetEmployeeIds = [...new Set((data ?? []).map((r) => r.target_employee_id).filter(Boolean) as string[])];
    const reviewerEmployeeIds = [...new Set((data ?? []).map((r) => r.reviewed_by_employee_id).filter(Boolean) as string[])];
    const regionIds = [...new Set((data ?? []).map((r) => r.requester_region_id).filter(Boolean) as string[])];
    const teamIdsFromTargets = [...new Set((data ?? []).map((r) => r.target_team_id).filter(Boolean) as string[])];
    const assetIds = [...new Set((data ?? []).map((r) => r.asset_id).filter(Boolean) as string[])];
    const payloadRequesterTeamIds = [
      ...new Set((data ?? []).map((r) => ((r.payload_json as Record<string, string> | null)?.requester_team_id ?? "")).filter(Boolean) as string[]),
    ];
    const payloadVehicleIds = [
      ...new Set(
        (data ?? [])
          .flatMap((r) => {
            const p = (r.payload_json ?? {}) as Record<string, string>;
            return [p.own_vehicle_id, p.target_vehicle_id];
          })
          .filter(Boolean) as string[]
      ),
    ];
    const teamIds = [...new Set([...teamIdsFromTargets, ...payloadRequesterTeamIds])];
    const employeeIds = [...new Set([...requesterIds, ...targetEmployeeIds, ...reviewerEmployeeIds])];

    const { data: employees } = employeeIds.length
      ? await supabase.from("employees").select("id, full_name").in("id", employeeIds)
      : { data: [] };
    const { data: regions } = regionIds.length
      ? await supabase.from("regions").select("id, name").in("id", regionIds)
      : { data: [] };
    const { data: teams } = teamIds.length
      ? await supabase.from("teams").select("id, name").in("id", teamIds)
      : { data: [] };
    const { data: assets } = assetIds.length
      ? await supabase.from("assets").select("id, asset_id, name").in("id", assetIds)
      : { data: [] };
    const { data: vehicles } = payloadVehicleIds.length
      ? await supabase.from("vehicles").select("id, plate_number, make, model").in("id", payloadVehicleIds)
      : { data: [] };

    const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
    const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t.name]));
    const assetMap = new Map((assets ?? []).map((a) => [a.id, { code: a.asset_id, name: a.name }]));
    const vehicleMap = new Map(
      (vehicles ?? []).map((v) => [v.id, `${v.plate_number}${v.make ? ` - ${v.make}` : ""}${v.model ? ` ${v.model}` : ""}`])
    );

    rows = (data ?? []).map((r) => {
      const payload = (r.payload_json ?? {}) as Record<string, string>;
      const ownVehicle = payload.own_vehicle_id ? vehicleMap.get(payload.own_vehicle_id) ?? "" : "";
      const targetVehicle = payload.target_vehicle_id ? vehicleMap.get(payload.target_vehicle_id) ?? "" : "";
      const requesterTeam = payload.requester_team_id ? teamMap.get(payload.requester_team_id) ?? "" : "";
      const targetDriver = payload.target_driver_id ? payload.target_driver_id : "";
      const relatedAsset = r.asset_id ? assetMap.get(r.asset_id) : undefined;

      return {
        request_type: r.request_type,
        status: r.status,
        requester_name: r.requester_employee_id ? empMap.get(r.requester_employee_id) ?? "" : "",
        region_name: r.requester_region_id ? regionMap.get(r.requester_region_id) ?? "" : "",
        target_employee_name: r.target_employee_id ? empMap.get(r.target_employee_id) ?? "" : "",
        target_team_name: r.target_team_id ? teamMap.get(r.target_team_id) ?? "" : "",
        related_asset_code: relatedAsset?.code ?? "",
        related_asset_name: relatedAsset?.name ?? "",
        request_reason: r.request_reason,
        notes: r.notes,
        reviewer_name: r.reviewed_by_employee_id ? empMap.get(r.reviewed_by_employee_id) ?? "" : "",
        reviewer_comment: r.reviewer_comment,
        reviewed_at: r.reviewed_at,
        created_at: r.created_at,
        requester_vehicle: ownVehicle,
        target_vehicle: targetVehicle,
        requester_team_name: requesterTeam,
        payload_target_driver_name: targetDriver ? empMap.get(targetDriver) ?? "" : "",
      };
    });
  } else if (dataset === "approvals") {
    const { data } = await supabase
      .from("approvals")
      .select(
        "approval_type, status, requester_id, region_id, asset_id, vehicle_id, payload_json, pm_acted_at, pm_acted_by, pm_comment, admin_acted_at, admin_acted_by, admin_comment, admin_final_approver_enabled, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    const requesterIds = [...new Set((data ?? []).map((r) => r.requester_id).filter(Boolean) as string[])];
    const regionIds = [...new Set((data ?? []).map((r) => r.region_id).filter(Boolean) as string[])];
    const assetFkIds = [...new Set((data ?? []).map((r) => r.asset_id).filter(Boolean) as string[])];
    const vehicleFkIds = [...new Set((data ?? []).map((r) => r.vehicle_id).filter(Boolean) as string[])];
    const actorIds = [
      ...new Set(
        [...(data ?? []).map((r) => r.pm_acted_by), ...(data ?? []).map((r) => r.admin_acted_by)].filter(Boolean) as string[]
      ),
    ];
    const { data: regions } = regionIds.length
      ? await supabase.from("regions").select("id, name").in("id", regionIds)
      : { data: [] };
    const { data: assetRows } = assetFkIds.length
      ? await supabase.from("assets").select("id, asset_id, name").in("id", assetFkIds)
      : { data: [] };
    const { data: vehicleRows } = vehicleFkIds.length
      ? await supabase.from("vehicles").select("id, plate_number, make, model").in("id", vehicleFkIds)
      : { data: [] };
    const requesterMap = await resolveUserDisplayMap(supabase, requesterIds);
    const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
    const assetMap = new Map((assetRows ?? []).map((a) => [a.id, { code: a.asset_id, name: a.name }]));
    const vehicleMap = new Map(
      (vehicleRows ?? []).map((v) => [v.id, { plate: v.plate_number, make: v.make, model: v.model }])
    );
    const actorMap = await resolveUserDisplayMap(supabase, actorIds);
    rows = (data ?? []).map((r) => {
      const a = r.asset_id ? assetMap.get(r.asset_id) : undefined;
      const veh = r.vehicle_id ? vehicleMap.get(r.vehicle_id) : undefined;
      return {
        approval_type: r.approval_type,
        status: r.status,
        requester_name: r.requester_id ? requesterMap.get(r.requester_id) ?? "" : "",
        region_name: r.region_id ? regionMap.get(r.region_id) ?? "" : "",
        related_asset_code: a?.code ?? "",
        related_asset_name: a?.name ?? "",
        related_vehicle_plate: veh?.plate ?? "",
        related_vehicle_make: veh?.make ?? "",
        related_vehicle_model: veh?.model ?? "",
        payload_json: r.payload_json != null ? JSON.stringify(r.payload_json) : "",
        pm_acted_at: r.pm_acted_at,
        pm_acted_by_name: r.pm_acted_by ? actorMap.get(r.pm_acted_by) ?? "" : "",
        pm_comment: r.pm_comment,
        admin_acted_at: r.admin_acted_at,
        admin_acted_by_name: r.admin_acted_by ? actorMap.get(r.admin_acted_by) ?? "" : "",
        admin_comment: r.admin_comment,
        admin_final_approver_enabled: r.admin_final_approver_enabled,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });
  } else if (dataset === "notifications") {
    const { data } = await supabase
      .from("notifications")
      .select("recipient_user_id, title, body, category, link, is_read, read_at, created_at")
      .order("created_at", { ascending: false });
    const recipientIds = [...new Set((data ?? []).map((r) => r.recipient_user_id).filter(Boolean) as string[])];
    const recipientMap = await resolveUserDisplayMap(supabase, recipientIds);
    rows = (data ?? []).map((r) => ({
      recipient_name: r.recipient_user_id ? recipientMap.get(r.recipient_user_id) ?? "" : "",
      title: r.title,
      body: r.body,
      category: r.category,
      link: r.link,
      is_read: r.is_read,
      read_at: r.read_at,
      created_at: r.created_at,
    }));
  } else if (dataset === "employees") {
    const { data } = await supabase
      .from("employees")
      .select(
        "employee_code, full_name, passport_number, country, email, phone, iqama_number, department, job_title, region_id, project_id, project_name_other, onboarding_date, accommodations, status, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    const regionIds = [...new Set((data ?? []).map((e) => e.region_id).filter(Boolean) as string[])];
    const projectIds = [...new Set((data ?? []).map((e) => e.project_id).filter(Boolean) as string[])];
    const { data: regions } = regionIds.length
      ? await supabase.from("regions").select("id, name").in("id", regionIds)
      : { data: [] };
    const { data: projects } = projectIds.length
      ? await supabase.from("projects").select("id, name").in("id", projectIds)
      : { data: [] };
    const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
    const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
    rows = (data ?? []).map((e) => ({
      employee_code: e.employee_code,
      full_name: e.full_name,
      passport_number: e.passport_number,
      country: e.country,
      email: e.email,
      phone: e.phone,
      iqama_number: e.iqama_number,
      department: e.department,
      job_title: e.job_title,
      region_name: e.region_id ? regionMap.get(e.region_id) ?? "" : "",
      project_name: e.project_id ? projectMap.get(e.project_id) ?? "" : e.project_name_other ?? "",
      onboarding_date: e.onboarding_date,
      accommodations: e.accommodations,
      status: e.status,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));
  } else {
    return NextResponse.json({ message: "Unsupported dataset" }, { status: 400 });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameFor(dataset)}"`,
      "Cache-Control": "no-store",
    },
  });
}
