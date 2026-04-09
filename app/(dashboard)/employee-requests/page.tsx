import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";

export default async function EmployeeRequestsPage() {
  const canView =
    (await can("approvals.view")) || (await can("approvals.approve")) || (await can("approvals.reject"));
  if (!canView) redirect("/dashboard");

  const supabase = await getDataClient();

  const [{ data: leaveApprovals }, { data: transfers }, { data: returnRows }] = await Promise.all([
    supabase
      .from("approvals")
      .select("id, status, requester_id, created_at, payload_json, region_id")
      .eq("approval_type", "leave_request")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("transfer_requests")
      .select(
        "id, request_type, status, requester_employee_id, target_employee_id, request_reason, created_at, reviewed_at, reviewer_comment, requester_region_id"
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("asset_return_requests")
      .select("id, asset_id, from_employee_id, status, employee_comment, pm_decision, created_at, processed_at, region_id")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const leaveUserIds = [...new Set((leaveApprovals ?? []).map((a) => a.requester_id))];
  const { data: leaveProfiles } = leaveUserIds.length
    ? await supabase.from("users_profile").select("id, full_name, email").in("id", leaveUserIds)
    : { data: [] };
  const profileMap = new Map((leaveProfiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || ""]));

  const transferEmpIds = [
    ...new Set(
      (transfers ?? []).flatMap((t) => [t.requester_employee_id, t.target_employee_id].filter(Boolean) as string[])
    ),
  ];
  const { data: transferEmps } = transferEmpIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", transferEmpIds)
    : { data: [] };
  const empMap = new Map((transferEmps ?? []).map((e) => [e.id, e.full_name ?? ""]));

  const regionIds = [...new Set((transfers ?? []).map((t) => t.requester_region_id).filter(Boolean) as string[])];
  const { data: regions } = regionIds.length
    ? await supabase.from("regions").select("id, name").in("id", regionIds)
    : { data: [] };
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));

  const returnEmpIds = [...new Set((returnRows ?? []).map((r) => r.from_employee_id))];
  const returnAssetIds = [...new Set((returnRows ?? []).map((r) => r.asset_id))];
  const [{ data: returnEmps }, { data: returnAssets }] = await Promise.all([
    returnEmpIds.length ? supabase.from("employees").select("id, full_name").in("id", returnEmpIds) : { data: [] },
    returnAssetIds.length ? supabase.from("assets").select("id, name, asset_id").in("id", returnAssetIds) : { data: [] },
  ]);
  const retEmpMap = new Map((returnEmps ?? []).map((e) => [e.id, e.full_name ?? ""]));
  const retAssetMap = new Map(
    (returnAssets ?? []).map((a) => [a.id, [a.name, a.asset_id].filter(Boolean).join(" · ") || a.id])
  );

  const leaveRows = (leaveApprovals ?? []).map((a) => {
    const payload = (a.payload_json as { from_date?: string; to_date?: string; requester_name?: string | null }) ?? {};
    const fromD = payload.from_date ?? "";
    const toD = payload.to_date ?? "";
    const { requestedDays, tracking, daysLeftInLeave } = leaveRequestTracking(fromD, toD, a.status);
    const nameFromPayload = payload.requester_name?.trim();
    const nameFromProfile = profileMap.get(a.requester_id);
    return {
      id: a.id,
      employee: nameFromPayload || nameFromProfile || a.requester_id,
      leave_from: fromD || "—",
      leave_to: toD || "—",
      requested_days: requestedDays || "—",
      days_left: daysLeftInLeave ?? "—",
      tracking,
      status: a.status,
      created_at: a.created_at,
    };
  });

  const transferTableRows = (transfers ?? []).map((t) => ({
    id: t.id,
    request_type: t.request_type,
    requester: empMap.get(t.requester_employee_id) || t.requester_employee_id,
    target: t.target_employee_id ? empMap.get(t.target_employee_id) || t.target_employee_id : "—",
    status: t.status,
    region: t.requester_region_id ? regionMap.get(t.requester_region_id) ?? "—" : "—",
    created_at: t.created_at,
    reason_preview: t.request_reason.length > 80 ? `${t.request_reason.slice(0, 80)}…` : t.request_reason,
  }));

  const returnTableRows = (returnRows ?? []).map((r) => ({
    id: r.id,
    asset: retAssetMap.get(r.asset_id) ?? r.asset_id,
    employee: retEmpMap.get(r.from_employee_id) ?? r.from_employee_id,
    status: r.status,
    pm_decision: r.pm_decision ?? "—",
    created_at: r.created_at,
    processed_at: r.processed_at,
    comment_preview: r.employee_comment.length > 60 ? `${r.employee_comment.slice(0, 60)}…` : r.employee_comment,
  }));

  const leaveCount = leaveRows.length;
  const transferCount = transferTableRows.length;
  const returnCount = returnTableRows.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-violet-50/80 via-white to-zinc-50 px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Employee requests</h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Monitor leave applications, internal transfers, and asset return submissions. Open a leave row for remarks
                and workflow actions. Use{" "}
                <Link href="/assets/returns" className="font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800">
                  Asset returns
                </Link>{" "}
                to process pending returns.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                <span className="font-medium text-zinc-700">Leave — days left</span> counts calendar days remaining in the
                approved window when today falls between the start and end date; otherwise see the tracking column.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <div className="rounded-xl border border-zinc-200/80 bg-white/90 px-3 py-2 text-center shadow-sm">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">{leaveCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Leave</p>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-white/90 px-3 py-2 text-center shadow-sm">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">{transferCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Transfers</p>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-white/90 px-3 py-2 text-center shadow-sm">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">{returnCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Returns</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Leave requests</h2>
            <p className="mt-0.5 text-sm text-zinc-600">Opens the full approval record for remarks and decisions.</p>
          </div>
          <Link href="/approvals" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            All approval types →
          </Link>
        </div>
        <div className="p-4 sm:p-6">
        <DataTable
          keyField="id"
          data={leaveRows}
          hrefPrefix="/approvals/"
          filterKeys={["status"]}
          searchPlaceholder="Search leave requests…"
          columns={[
            { key: "employee", label: "Employee" },
            { key: "leave_from", label: "From" },
            { key: "leave_to", label: "To" },
            { key: "requested_days", label: "Days (range)" },
            { key: "days_left", label: "Days left" },
            { key: "tracking", label: "Tracking" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Submitted", format: "datetime" },
          ]}
        />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5">
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-zinc-900">Transfer requests</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            Vehicle swap, replacement, drive swap, and asset transfer requests between employees or teams.
          </p>
        </div>
        <div className="p-4 sm:p-6">
        <DataTable
          keyField="id"
          data={transferTableRows}
          hrefPrefix="/employee-requests/transfers/"
          filterKeys={["request_type", "status"]}
          searchPlaceholder="Search transfers…"
          columns={[
            { key: "request_type", label: "Type" },
            { key: "requester", label: "Requester" },
            { key: "target", label: "Target" },
            { key: "region", label: "Region" },
            { key: "status", label: "Status" },
            { key: "reason_preview", label: "Reason" },
            { key: "created_at", label: "Created", format: "datetime" },
          ]}
        />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Asset return requests</h2>
            <p className="mt-0.5 text-sm text-zinc-600">Summary of return submissions from the employee portal.</p>
          </div>
          <Link href="/assets/returns" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Open return queue →
          </Link>
        </div>
        <div className="p-4 sm:p-6">
        <DataTable
          keyField="id"
          data={returnTableRows}
          filterKeys={["status"]}
          searchPlaceholder="Search returns…"
          columns={[
            { key: "asset", label: "Asset" },
            { key: "employee", label: "Employee" },
            { key: "status", label: "Status" },
            { key: "pm_decision", label: "PM decision" },
            { key: "comment_preview", label: "Employee note" },
            { key: "created_at", label: "Submitted", format: "datetime" },
            { key: "processed_at", label: "Processed", format: "datetime" },
          ]}
        />
        </div>
      </section>
    </div>
  );
}
