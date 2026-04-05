import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ApprovalActions } from "@/components/approvals/ApprovalActions";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: approval } = await supabase.from("approvals").select("*").eq("id", id).single();
  if (!approval) notFound();
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const canApprove = await can("approvals.approve");
  const canReject = await can("approvals.reject");
  const isAdminNonSuper = !isSuper && (canApprove || canReject);

  const allowActions =
    approval.approval_type === "leave_request"
      ? (approval.status === "Submitted" && isAdminNonSuper) || (approval.status === "Admin_Approved" && isSuper)
      : (canApprove || canReject);

  const { data: requester } = await supabase.from("users_profile").select("full_name, email").eq("id", approval.requester_id).single();
  const leavePayload =
    approval.approval_type === "leave_request"
      ? ((approval.payload_json as { from_date?: string; to_date?: string; reason?: string }) ?? {})
      : null;
  const leaveMetrics =
    leavePayload && leavePayload.from_date && leavePayload.to_date
      ? leaveRequestTracking(leavePayload.from_date, leavePayload.to_date, approval.status)
      : null;
  const leaveHistory = approval.approval_type === "leave_request"
    ? await supabase
        .from("approvals")
        .select("id, status, created_at, payload_json, admin_comment, pm_comment")
        .eq("approval_type", "leave_request")
        .eq("requester_id", approval.requester_id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/approvals" className="text-sm text-zinc-500 hover:text-zinc-900">← Approvals</Link>
        <h1 className="text-2xl font-semibold text-zinc-900">{approval.approval_type}</h1>
        <span className="rounded bg-zinc-200 px-2 py-0.5 text-sm text-zinc-700">{approval.status}</span>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <dl className="grid gap-2 text-sm">
          <div><dt className="text-zinc-500">Requester</dt><dd>{requester?.full_name || requester?.email || approval.requester_id}</dd></div>
          <div><dt className="text-zinc-500">Submitted</dt><dd>{new Date(approval.created_at).toLocaleString()}</dd></div>
          {approval.approval_type === "leave_request" && leavePayload && (
            <>
              <div>
                <dt className="text-zinc-500">Leave period</dt>
                <dd>
                  {leavePayload.from_date ?? "—"} → {leavePayload.to_date ?? "—"}
                  {leaveMetrics ? (
                    <span className="ml-2 text-zinc-600">
                      ({leaveMetrics.requestedDays} day{leaveMetrics.requestedDays === 1 ? "" : "s"} requested)
                    </span>
                  ) : null}
                </dd>
              </div>
              {leaveMetrics ? (
                <div>
                  <dt className="text-zinc-500">Tracking</dt>
                  <dd>{leaveMetrics.tracking}</dd>
                </div>
              ) : null}
              {leaveMetrics?.daysLeftInLeave != null ? (
                <div>
                  <dt className="text-zinc-500">Days left in this leave</dt>
                  <dd>{leaveMetrics.daysLeftInLeave}</dd>
                </div>
              ) : null}
              {leavePayload.reason ? (
                <div>
                  <dt className="text-zinc-500">Reason</dt>
                  <dd>{leavePayload.reason}</dd>
                </div>
              ) : null}
            </>
          )}
          {approval.pm_comment && <div><dt className="text-zinc-500">GM comment</dt><dd>{approval.pm_comment}</dd></div>}
          {approval.admin_comment && <div><dt className="text-zinc-500">Admin comment</dt><dd>{approval.admin_comment}</dd></div>}
          {/* {approval.payload_json && Object.keys(approval.payload_json).length > 0 && (
            <div><dt className="text-zinc-500">Payload</dt><dd><pre className="mt-1 overflow-auto rounded bg-zinc-100 p-2 text-xs">{JSON.stringify(approval.payload_json, null, 2)}</pre></dd></div>
          )} */}
        </dl>
      </div>
      {approval.approval_type === "leave_request" && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Leave history (requester)</h2>
          {!(leaveHistory.data ?? []).length ? (
            <p className="text-sm text-zinc-500">No previous leave requests.</p>
          ) : (
            <ul className="space-y-2">
              {(leaveHistory.data ?? []).map((h) => {
                const payload = (h.payload_json as { from_date?: string; to_date?: string; reason?: string }) ?? {};
                return (
                  <li key={h.id} className="rounded border border-zinc-100 bg-zinc-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-zinc-900">{payload.from_date ?? "—"} to {payload.to_date ?? "—"}</span>
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">{h.status}</span>
                    </div>
                    {payload.reason ? <p className="mt-1 text-zinc-600">Reason: {payload.reason}</p> : null}
                    {(h.admin_comment || h.pm_comment) ? (
                      <p className="mt-1 text-zinc-500">Remarks: {h.admin_comment || h.pm_comment}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <ApprovalActions approval={approval} allowActions={allowActions} />
      <EntityHistory entityType="approval" entityId={id} />
    </div>
  );
}
