export type ExportItem = { key: string; label: string; desc: string };

export const SCOPE_EXPORTS: ExportItem[] = [
  {
    key: "region_wise",
    label: "Region-wise summary",
    desc: "One row per region: employees, assets, vehicles, SIMs, and teams in that region.",
  },
  {
    key: "project_wise",
    label: "Project-wise summary",
    desc: "One row per project: employees, assets, vehicles (via assignees), SIMs, and teams.",
  },
  {
    key: "region_project_wise",
    label: "Region + project summary",
    desc: "One row per region and project combination, with the same operational counts.",
  },
];

export const OPERATIONAL_EXPORTS: ExportItem[] = [
  {
    key: "assets_master",
    label: "Assets (master)",
    desc: "All assets with status, assignment, region, project, and purchase/condition photo URLs (count + pipe-separated links).",
  },
  { key: "asset_assignment_history", label: "Asset assignment history", desc: "Every asset assignment event with actor and timestamp." },
  { key: "asset_returns", label: "Asset return requests", desc: "Return requests, comments, PM decision, and processing dates." },
  { key: "sims_master", label: "SIM cards (master)", desc: "SIM inventory with status and employee assignment details." },
  { key: "sim_assignment_history", label: "SIM assignment history", desc: "Every SIM assignment/unassignment event." },
  {
    key: "vehicles_master",
    label: "Vehicles (master)",
    desc: "Vehicles with assignment state, related employee, and condition photo URLs (count + pipe-separated links).",
  },
  { key: "vehicle_assignments", label: "Vehicle assignments", desc: "Vehicle-to-employee assignment table with names." },
  { key: "transfer_requests", label: "Transfer requests", desc: "DT/Driver transfer requests with reviewer decisions and related entities." },
  { key: "approvals", label: "Approvals", desc: "All approvals with status and remarks (leave, asset, etc)." },
  { key: "notifications", label: "Notifications", desc: "System notifications including read status and category." },
  { key: "employees", label: "Employees", desc: "Employee directory with status, region, project, and dates." },
];

export const ALL_EXPORT_KEYS = [...SCOPE_EXPORTS, ...OPERATIONAL_EXPORTS].map((e) => e.key);
