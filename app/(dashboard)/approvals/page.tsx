import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/ui/DataTable";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";

export default async function ApprovalsPage() {
  if (!(await can("approvals.view"))) redirect("/dashboard");
  const supabase = await getDataClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, approval_type, status, requester_id, created_at, payload_json")
    .order("created_at", { ascending: false });

  const userIds = [...new Set((approvals ?? []).map((a) => a.requester_id))];
  const { data: profiles } = await supabase.from("users_profile").select("id, full_name, email").in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const rowsRaw = (approvals ?? []).map((a) => {
    const payload = (a.payload_json as { from_date?: string; to_date?: string; requester_name?: string | null }) ?? {};
    const nameFromPayload = payload.requester_name?.trim();
    const requester_name = nameFromPayload || profileMap.get(a.requester_id) || a.requester_id;

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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Approvals</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            All workflow requests (leave, assets, vehicles, maintenance). Super Users and Admins see every row,
            including submitted leave. For a focused view with transfers and returns, open{" "}
            <a href="/employee-requests" className="font-medium text-indigo-600 hover:text-indigo-800">
              Employee requests
            </a>
            .
          </p>
        </div>
      </div>
      <DataTable
        keyField="id"
        data={rowsRaw}
        hrefPrefix="/approvals/"
        filterKeys={["approval_type", "status"]}
        searchPlaceholder="Search approvals…"
        columns={columns}
      />
    </div>
  );
}
