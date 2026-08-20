import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiAuthContext } from "@/lib/mobile/api-auth-context";
import type { UsersProfileWithRegion } from "@/lib/types/database";

function profileRegionId(ctx: ApiAuthContext): string | null {
  return (ctx.profile as UsersProfileWithRegion).region_id ?? null;
}

export type ResourceCounts = {
  total: number;
  assigned: number;
  available: number;
  pendingReturn: number;
  underMaintenance: number;
  damaged: number;
};

export type ProjectInventoryRow = {
  projectId: string | null;
  projectName: string;
  assets: ResourceCounts;
  vehicles: ResourceCounts;
  sims: ResourceCounts;
  employeeCount: number;
};

export type RegionInventoryRow = {
  regionId: string;
  regionName: string;
  regionCode: string | null;
  assets: ResourceCounts;
  vehicles: ResourceCounts;
  sims: ResourceCounts;
  employeeCount: number;
  projects: ProjectInventoryRow[];
};

export type InventoryOverview = {
  totals: {
    assets: ResourceCounts;
    vehicles: ResourceCounts;
    sims: ResourceCounts;
  };
  regions: RegionInventoryRow[];
};

function emptyCounts(): ResourceCounts {
  return { total: 0, assigned: 0, available: 0, pendingReturn: 0, underMaintenance: 0, damaged: 0 };
}

function bumpAsset(counts: ResourceCounts, status: string, assignedTo: string | null) {
  counts.total += 1;
  if (status === "Pending_Return") counts.pendingReturn += 1;
  else if (status === "Under_Maintenance") counts.underMaintenance += 1;
  else if (status === "Damaged") counts.damaged += 1;
  else if (status === "Available" && !assignedTo) counts.available += 1;
  else counts.assigned += 1;
}

function bumpVehicle(counts: ResourceCounts, status: string, hasAssignee: boolean) {
  counts.total += 1;
  if (status === "Under_Maintenance") counts.underMaintenance += 1;
  else if (status === "Damaged") counts.damaged += 1;
  else if (hasAssignee || status === "Assigned") counts.assigned += 1;
  else counts.available += 1;
}

function bumpSim(counts: ResourceCounts, status: string, assignedTo: string | null) {
  counts.total += 1;
  if (status === "Inactive") counts.damaged += 1;
  else if (assignedTo || status === "Assigned") counts.assigned += 1;
  else counts.available += 1;
}

export async function buildInventoryOverview(
  ctx: ApiAuthContext,
  supabase: SupabaseClient
): Promise<InventoryOverview> {
  const scopeRegionId = ctx.isSuper ? null : profileRegionId(ctx);

  let regionQuery = supabase.from("regions").select("id, name, code").order("name");
  if (scopeRegionId) regionQuery = regionQuery.eq("id", scopeRegionId);
  const { data: regions } = await regionQuery;

  let projectQuery = supabase.from("projects").select("id, name, region_id").order("name");
  if (scopeRegionId) projectQuery = projectQuery.eq("region_id", scopeRegionId);
  const { data: projects } = await projectQuery;

  let assetQuery = supabase
    .from("assets")
    .select("id, status, assigned_to_employee_id, assigned_region_id, assigned_project_id")
    .eq("is_ehs_tool", false);
  if (scopeRegionId) assetQuery = assetQuery.eq("assigned_region_id", scopeRegionId);

  let vehicleQuery = supabase.from("vehicles").select("id, status, assigned_region_id");
  if (scopeRegionId) vehicleQuery = vehicleQuery.eq("assigned_region_id", scopeRegionId);

  const [{ data: assets }, { data: vehicles }, { data: assigns }, { data: sims }, { data: employees }] =
    await Promise.all([
      assetQuery,
      vehicleQuery,
      supabase.from("vehicle_assignments").select("vehicle_id, employee_id"),
      supabase.from("sim_cards").select("id, status, assigned_to_employee_id"),
      supabase.from("employees").select("id, region_id, project_id, status"),
    ]);

  const assignByVehicle = new Map<string, string>();
  for (const a of assigns ?? []) {
    if (a.vehicle_id && a.employee_id) assignByVehicle.set(a.vehicle_id as string, a.employee_id as string);
  }

  const empById = new Map((employees ?? []).map((e) => [e.id as string, e]));
  const projectName = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  const totals = {
    assets: emptyCounts(),
    vehicles: emptyCounts(),
    sims: emptyCounts(),
  };

  type Bucket = {
    assets: ResourceCounts;
    vehicles: ResourceCounts;
    sims: ResourceCounts;
    employeeIds: Set<string>;
  };

  const regionBuckets = new Map<string, Bucket>();
  const projectBuckets = new Map<string, Bucket>(); // key = regionId|projectId

  function ensureRegion(regionId: string): Bucket {
    let b = regionBuckets.get(regionId);
    if (!b) {
      b = { assets: emptyCounts(), vehicles: emptyCounts(), sims: emptyCounts(), employeeIds: new Set() };
      regionBuckets.set(regionId, b);
    }
    return b;
  }

  function ensureProject(regionId: string, projectId: string | null): Bucket {
    const key = `${regionId}|${projectId ?? ""}`;
    let b = projectBuckets.get(key);
    if (!b) {
      b = { assets: emptyCounts(), vehicles: emptyCounts(), sims: emptyCounts(), employeeIds: new Set() };
      projectBuckets.set(key, b);
    }
    return b;
  }

  for (const a of assets ?? []) {
    bumpAsset(totals.assets, String(a.status ?? ""), a.assigned_to_employee_id as string | null);
    const regionId = (a.assigned_region_id as string | null) ?? null;
    if (!regionId) continue;
    if (scopeRegionId && regionId !== scopeRegionId) continue;
    const rb = ensureRegion(regionId);
    bumpAsset(rb.assets, String(a.status ?? ""), a.assigned_to_employee_id as string | null);
    const pb = ensureProject(regionId, (a.assigned_project_id as string | null) ?? null);
    bumpAsset(pb.assets, String(a.status ?? ""), a.assigned_to_employee_id as string | null);
  }

  for (const v of vehicles ?? []) {
    const assigneeId = assignByVehicle.get(v.id as string) ?? null;
    const hasAssignee = Boolean(assigneeId);
    bumpVehicle(totals.vehicles, String(v.status ?? ""), hasAssignee);
    const regionId =
      (v.assigned_region_id as string | null) ??
      (assigneeId ? ((empById.get(assigneeId)?.region_id as string | null) ?? null) : null);
    if (!regionId) continue;
    if (scopeRegionId && regionId !== scopeRegionId) continue;
    const rb = ensureRegion(regionId);
    bumpVehicle(rb.vehicles, String(v.status ?? ""), hasAssignee);
    const projectId = assigneeId ? ((empById.get(assigneeId)?.project_id as string | null) ?? null) : null;
    const pb = ensureProject(regionId, projectId);
    bumpVehicle(pb.vehicles, String(v.status ?? ""), hasAssignee);
  }

  for (const s of sims ?? []) {
    const assigneeId = (s.assigned_to_employee_id as string | null) ?? null;
    const emp = assigneeId ? empById.get(assigneeId) : null;
    const regionId = (emp?.region_id as string | null) ?? null;
    if (scopeRegionId && regionId !== scopeRegionId) {
      // still count in totals for super; for scoped admin skip unscoped sims
      if (scopeRegionId) continue;
    }
    bumpSim(totals.sims, String(s.status ?? ""), assigneeId);
    if (!regionId) continue;
    const rb = ensureRegion(regionId);
    bumpSim(rb.sims, String(s.status ?? ""), assigneeId);
    const pb = ensureProject(regionId, (emp?.project_id as string | null) ?? null);
    bumpSim(pb.sims, String(s.status ?? ""), assigneeId);
  }

  for (const e of employees ?? []) {
    if (String(e.status ?? "") !== "ACTIVE") continue;
    const regionId = e.region_id as string | null;
    if (!regionId) continue;
    if (scopeRegionId && regionId !== scopeRegionId) continue;
    ensureRegion(regionId).employeeIds.add(e.id as string);
    ensureProject(regionId, (e.project_id as string | null) ?? null).employeeIds.add(e.id as string);
  }

  // Ensure every known region appears even if empty
  for (const r of regions ?? []) {
    ensureRegion(r.id as string);
  }

  const regionRows: RegionInventoryRow[] = (regions ?? []).map((r) => {
    const regionId = r.id as string;
    const bucket = regionBuckets.get(regionId) ?? {
      assets: emptyCounts(),
      vehicles: emptyCounts(),
      sims: emptyCounts(),
      employeeIds: new Set<string>(),
    };
    const projectsForRegion: ProjectInventoryRow[] = (projects ?? [])
      .filter((p) => p.region_id === regionId)
      .map((p) => {
        const pb =
          projectBuckets.get(`${regionId}|${p.id}`) ??
          ({
            assets: emptyCounts(),
            vehicles: emptyCounts(),
            sims: emptyCounts(),
            employeeIds: new Set<string>(),
          } as Bucket);
        return {
          projectId: p.id as string,
          projectName: p.name as string,
          assets: pb.assets,
          vehicles: pb.vehicles,
          sims: pb.sims,
          employeeCount: pb.employeeIds.size,
        };
      })
      .filter((p) => p.assets.total + p.vehicles.total + p.sims.total + p.employeeCount > 0)
      .sort((a, b) => a.projectName.localeCompare(b.projectName));

    const noProject = projectBuckets.get(`${regionId}|`);
    if (noProject && noProject.assets.total + noProject.vehicles.total + noProject.sims.total > 0) {
      projectsForRegion.push({
        projectId: null,
        projectName: "(no project)",
        assets: noProject.assets,
        vehicles: noProject.vehicles,
        sims: noProject.sims,
        employeeCount: noProject.employeeIds.size,
      });
    }

    return {
      regionId,
      regionName: r.name as string,
      regionCode: (r.code as string | null) ?? null,
      assets: bucket.assets,
      vehicles: bucket.vehicles,
      sims: bucket.sims,
      employeeCount: bucket.employeeIds.size,
      projects: projectsForRegion,
    };
  });

  return { totals, regions: regionRows };
}

export type WhoHasAssetLine = {
  id: string;
  name: string | null;
  model: string | null;
  serial: string | null;
  category: string | null;
  status: string;
};

export type WhoHasVehicleLine = {
  id: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  status: string;
};

export type WhoHasSimLine = {
  id: string;
  simNumber: string | null;
  phoneNumber: string | null;
  operator: string | null;
  status: string;
};

export type WhoHasEmployeeRow = {
  employeeId: string;
  fullName: string;
  email: string | null;
  regionName: string | null;
  projectName: string | null;
  assetCount: number;
  vehicleCount: number;
  simCount: number;
  assets: WhoHasAssetLine[];
  vehicles: WhoHasVehicleLine[];
  sims: WhoHasSimLine[];
};

export async function buildWhoHasAssets(
  ctx: ApiAuthContext,
  supabase: SupabaseClient,
  options?: { regionId?: string | null; projectId?: string | null; limit?: number }
): Promise<{
  items: WhoHasEmployeeRow[];
  totalEmployees: number;
  totalAssets: number;
  totalVehicles: number;
  totalSims: number;
}> {
  const scopeRegionId = ctx.isSuper ? options?.regionId ?? null : profileRegionId(ctx);
  const projectId = options?.projectId ?? null;
  const limit = Math.min(Math.max(options?.limit ?? 80, 1), 150);

  let assetQuery = supabase
    .from("assets")
    .select("id, name, model, serial, category, status, assigned_to_employee_id, assigned_region_id, assigned_project_id")
    .eq("is_ehs_tool", false)
    .not("assigned_to_employee_id", "is", null)
    .in("status", ["Assigned", "Under_Maintenance", "Damaged", "With_QC", "Pending_Return"]);
  if (scopeRegionId) assetQuery = assetQuery.eq("assigned_region_id", scopeRegionId);
  if (projectId) assetQuery = assetQuery.eq("assigned_project_id", projectId);

  const [{ data: assignedAssets }, { data: vehicleAssigns }, { data: sims }] = await Promise.all([
    assetQuery.order("name").limit(2000),
    supabase.from("vehicle_assignments").select("vehicle_id, employee_id"),
    supabase
      .from("sim_cards")
      .select("id, sim_number, phone_number, operator, status, assigned_to_employee_id")
      .not("assigned_to_employee_id", "is", null)
      .limit(2000),
  ]);

  const vehicleIds = [...new Set((vehicleAssigns ?? []).map((a) => a.vehicle_id).filter(Boolean) as string[])];
  const { data: vehicles } =
    vehicleIds.length > 0
      ? await supabase.from("vehicles").select("id, plate_number, make, model, status, assigned_region_id").in("id", vehicleIds)
      : { data: [] as { id: string; plate_number: string | null; make: string | null; model: string | null; status: string; assigned_region_id: string | null }[] };

  const vehicleMap = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const empIds = [
    ...new Set([
      ...(assignedAssets ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean),
      ...(vehicleAssigns ?? []).map((a) => a.employee_id).filter(Boolean),
      ...(sims ?? []).map((s) => s.assigned_to_employee_id).filter(Boolean),
    ] as string[]),
  ];

  const [{ data: emps }, { data: regions }, { data: projects }] = await Promise.all([
    empIds.length
      ? supabase.from("employees").select("id, full_name, email, region_id, project_id, status").in("id", empIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string;
            email: string | null;
            region_id: string | null;
            project_id: string | null;
            status: string;
          }[],
        }),
    supabase.from("regions").select("id, name"),
    supabase.from("projects").select("id, name"),
  ]);

  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const empMap = new Map((emps ?? []).filter((e) => e.status === "ACTIVE").map((e) => [e.id, e]));

  type Bundle = {
    assets: WhoHasAssetLine[];
    vehicles: WhoHasVehicleLine[];
    sims: WhoHasSimLine[];
  };
  const byEmp = new Map<string, Bundle>();

  function ensure(eid: string): Bundle | null {
    if (!empMap.has(eid)) return null;
    let b = byEmp.get(eid);
    if (!b) {
      b = { assets: [], vehicles: [], sims: [] };
      byEmp.set(eid, b);
    }
    return b;
  }

  function inScope(empId: string, assignedRegionId?: string | null): boolean {
    const emp = empMap.get(empId);
    if (!emp) return false;
    if (scopeRegionId) {
      const regionOk = assignedRegionId === scopeRegionId || emp.region_id === scopeRegionId;
      if (!regionOk) return false;
    }
    if (projectId && emp.project_id !== projectId) return false;
    return true;
  }

  for (const a of assignedAssets ?? []) {
    const eid = a.assigned_to_employee_id as string | null;
    if (!eid || !inScope(eid, a.assigned_region_id as string | null)) continue;
    const b = ensure(eid);
    if (!b) continue;
    b.assets.push({
      id: a.id,
      name: a.name ?? null,
      model: a.model ?? null,
      serial: a.serial ?? null,
      category: a.category ?? null,
      status: a.status,
    });
  }

  for (const va of vehicleAssigns ?? []) {
    const eid = va.employee_id as string | null;
    const vehicle = va.vehicle_id ? vehicleMap.get(va.vehicle_id as string) : null;
    if (!eid || !vehicle || !inScope(eid, vehicle.assigned_region_id)) continue;
    const b = ensure(eid);
    if (!b) continue;
    b.vehicles.push({
      id: vehicle.id,
      plate: vehicle.plate_number ?? null,
      make: vehicle.make ?? null,
      model: vehicle.model ?? null,
      status: vehicle.status,
    });
  }

  for (const s of sims ?? []) {
    const eid = s.assigned_to_employee_id as string | null;
    if (!eid || !inScope(eid)) continue;
    const b = ensure(eid);
    if (!b) continue;
    b.sims.push({
      id: s.id,
      simNumber: (s as { sim_number?: string | null }).sim_number ?? null,
      phoneNumber: (s as { phone_number?: string | null }).phone_number ?? null,
      operator: (s as { operator?: string | null }).operator ?? null,
      status: s.status,
    });
  }

  const items = [...byEmp.entries()]
    .map(([employeeId, bundle]) => {
      const emp = empMap.get(employeeId)!;
      return {
        employeeId,
        fullName: emp.full_name,
        email: emp.email ?? null,
        regionName: emp.region_id ? (regionMap.get(emp.region_id) ?? null) : null,
        projectName: emp.project_id ? (projectMap.get(emp.project_id) ?? null) : null,
        assetCount: bundle.assets.length,
        vehicleCount: bundle.vehicles.length,
        simCount: bundle.sims.length,
        assets: bundle.assets.slice(0, 20),
        vehicles: bundle.vehicles.slice(0, 10),
        sims: bundle.sims.slice(0, 10),
      };
    })
    .filter((row) => row.assetCount + row.vehicleCount + row.simCount > 0)
    .sort(
      (a, b) =>
        b.assetCount + b.vehicleCount + b.simCount - (a.assetCount + a.vehicleCount + a.simCount) ||
        a.fullName.localeCompare(b.fullName)
    )
    .slice(0, limit);

  return {
    items,
    totalEmployees: byEmp.size,
    totalAssets: [...byEmp.values()].reduce((n, b) => n + b.assets.length, 0),
    totalVehicles: [...byEmp.values()].reduce((n, b) => n + b.vehicles.length, 0),
    totalSims: [...byEmp.values()].reduce((n, b) => n + b.sims.length, 0),
  };
}
