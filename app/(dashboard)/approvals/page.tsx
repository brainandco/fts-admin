import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";

export default async function ApprovalsPage() {
  const canView = await can("approvals.view");
  const canApprove = await can("approvals.approve");
  const canReject = await can("approvals.reject");
  if (!canView && !canApprove && !canReject) redirect("/dashboard");
  const supabase = await getDataClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, approval_type, status, requester_id, created_at, payload_json")
    .order("created_at", { ascending: false });

  const userIds = [...new Set((approvals ?? []).map((a) => a.requester_id))];
  const { data: profiles } = await supabase.from("users_profile").select("id, full_name, email").in("id", userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rawEmails = [...new Set((profiles ?? []).map((p) => (p.email ?? "").trim()).filter(Boolean))];
  const { data: employeesMatch } =
    rawEmails.length > 0
      ? await supabase.from("employees").select("email, full_name").in("email", rawEmails)
      : { data: [] as { email: string; full_name: string | null }[] };
  const emailToEmployeeName = new Map<string, string>();
  for (const row of employeesMatch ?? []) {
    const em = (row.email ?? "").trim().toLowerCase();
    const fn = (row.full_name ?? "").trim();
    if (em && fn) emailToEmployeeName.set(em, fn);
  }

  const rowsRaw = (approvals ?? []).map((a) => {
    const payload =
      (a.payload_json as {
        from_date?: string;
        to_date?: string;
        requester_name?: string | null;
        requester_display_name?: string | null;
      }) ?? {};
    const nameFromPayload = (payload.requester_display_name ?? payload.requester_name)?.trim();
    const prof = profileById.get(a.requester_id);
    const viaEmployee = prof?.email ? emailToEmployeeName.get(prof.email.trim().toLowerCase()) : undefined;
    const requester_name =
      nameFromPayload ||
      (prof?.full_name ?? "").trim() ||
      viaEmployee ||
      prof?.email ||
      a.requester_id;

    let leave_from = "";
    let leave_to = "";
    let leave_days = "";
    let leave_tracking = "";
    let leave_days_left: string | number = "";
    if (a.approval_type === "leave_request") {
      const fromD = payload.from_date ?? "";
      const toD = payload.to_date ?? "";
      leave_from = fromD;
      leave_to = toD;
      const { requestedDays, tracking, daysLeftInLeave } = leaveRequestTracking(fromD, toD, a.status);
      leave_days = requestedDays > 0 ? String(requestedDays) : "—";
      leave_tracking = tracking;
      leave_days_left = daysLeftInLeave ?? "—";
    }

    return {
      ...a,
      requester_name,
      leave_from: leave_from || "—",
      leave_to: leave_to || "—",
      leave_days,
      leave_days_left,
      leave_tracking: leave_tracking || "—",
    };
  });

  const baseColumns = [
    { key: "approval_type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "requester_name", label: "Requester" },
  ];

  const leaveColumns = [
    { key: "leave_from", label: "Leave from" },
    { key: "leave_to", label: "Leave to" },
    { key: "leave_days", label: "Days" },
    { key: "leave_days_left", label: "Days left" },
    { key: "leave_tracking", label: "Leave tracking" },
  ];

  const columns = rowsRaw.some((r) => r.approval_type === "leave_request")
    ? [...baseColumns, ...leaveColumns, { key: "created_at", label: "Created", format: "datetime" as const }]
    : [...baseColumns, { key: "created_at", label: "Created", format: "datetime" as const }];

  const total = rowsRaw.length;
  const pendingSubmitted = rowsRaw.filter((r) => r.status === "Submitted").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-indigo-50/80 via-white to-zinc-50 px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Approvals</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
                Workflow requests across leave, assets, vehicles, and maintenance.
                {/* For transfers and returns, use{" "}
                <a href="/employee-requests" className="font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800">
                  Employee requests
                </a>
                . */}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-2.5 text-center shadow-sm">
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">{total}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total</p>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-2.5 text-center shadow-sm">
                <p className="text-2xl font-semibold tabular-nums text-amber-900">{pendingSubmitted}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80">Submitted</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <DataTable
            keyField="id"
            data={rowsRaw}
            hrefPrefix="/approvals/"
            filterKeys={["approval_type", "status"]}
            searchPlaceholder="Search by type, status, requester…"
            columns={columns}
          />
        </div>
      </div>
    </div>
  );
}
