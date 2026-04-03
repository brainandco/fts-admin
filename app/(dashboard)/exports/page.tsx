import Link from "next/link";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

type ExportItem = { key: string; label: string; desc: string };

const EXPORTS: ExportItem[] = [
  { key: "assets_master", label: "Assets (master)", desc: "All assets with status, assignment, region, and project." },
  { key: "asset_assignment_history", label: "Asset assignment history", desc: "Every asset assignment event with actor and timestamp." },
  { key: "asset_returns", label: "Asset return requests", desc: "Return requests, comments, PM decision, and processing dates." },
  { key: "sims_master", label: "SIM cards (master)", desc: "SIM inventory with status and employee assignment details." },
  { key: "sim_assignment_history", label: "SIM assignment history", desc: "Every SIM assignment/unassignment event." },
  { key: "vehicles_master", label: "Vehicles (master)", desc: "Vehicles with assignment state and related employee." },
  { key: "vehicle_assignments", label: "Vehicle assignments", desc: "Vehicle-to-employee assignment table with names." },
  { key: "transfer_requests", label: "Transfer requests", desc: "DT/Driver transfer requests with reviewer decisions and related entities." },
  { key: "approvals", label: "Approvals", desc: "All approvals with status and remarks (leave, asset, etc)." },
  { key: "notifications", label: "Notifications", desc: "System notifications including read status and category." },
  { key: "employees", label: "Employees", desc: "Employee directory with status, region, project, and dates." },
];

export default async function ExportsPage() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const isAdmin = await can("approvals.approve");
  if (!isSuper && !isAdmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-cyan-50 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Exports Center</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Centralized exports for all operational datasets. Download Excel-compatible CSV files from one page.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {EXPORTS.map((item) => (
          <section key={item.key} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">{item.label}</h2>
            <p className="mt-1 text-sm text-zinc-600">{item.desc}</p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href={`/api/exports?dataset=${encodeURIComponent(item.key)}`}
                className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Download CSV
              </a>
              <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-800">
                Back to dashboard
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
