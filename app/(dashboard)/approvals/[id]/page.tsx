import { getDataClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ApprovalActions } from "@/components/approvals/ApprovalActions";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canView = await can("approvals.view");
  const canApprove = await can("approvals.approve");
  const canReject = await can("approvals.reject");
  if (!canView && !canApprove && !canReject) redirect("/dashboard");

  const supabase = await getDataClient();
  const { data: approval } = await supabase.from("approvals").select("*").eq("id", id).maybeSingle();
  if (!approval) notFound();
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const isAdminNonSuper = !isSuper && (canApprove || canReject);

  const adminThenSuperWorkflow =
    approval.approval_type === "leave_request" || approval.approval_type === "asset_request";

  const allowActions =
    approval.approval_type === "leave_request"
      ? (approval.status === "Submitted" && isAdminNonSuper) ||
        (approval.status === "Performa_Submitted" && isSuper)
      : adminThenSuperWorkflow
        ? (approval.status === "Submitted" && isAdminNonSuper) || (approval.status === "Admin_Approved" && isSuper)
        : canApprove || canReject;

  const { data: requester } = await supabase
    .from("users_profile")
    .select("full_name, email")
    .eq("id", approval.requester_id)
    .maybeSingle();
  const assetPayload =
    approval.approval_type === "asset_request"
      ? ((approval.payload_json as {
          asset_name?: string;
          category?: string;
          quantity?: number;
          reason?: string;
          priority?: string;
        }) ?? {})
      : null;
  const leavePayload =
    approval.approval_type === "leave_request"
      ? ((approval.payload_json as {
          from_date?: string;
          to_date?: string;
          reason?: string;
          leave_type?: string;
          guarantor_display_name?: string;
          filled_performa_pdf_url?: string;
          signed_performa_pdf_url?: string;
          performa_requester_message?: string;
        }) ?? {})
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
      {approval.approval_type === "asset_request" ? (
        <p className="text-sm text-zinc-600">
          Workflow: Admin reviews first (remarks required), then Super User gives the final approve or reject decision (remarks required).
        </p>
      ) : null}
      {approval.approval_type === "leave_request" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-zinc-800">
          <p className="font-medium text-zinc-900">Leave performa workflow</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
            <li>
              <strong>Submitted:</strong> Next actor is an <strong>Admin</strong> (remarks required on approve or reject). Approve generates a filled PDF for the requester.
            </li>
            <li>
              <strong>Awaiting signed performa:</strong> Next actor is the <strong>requester</strong> (print/sign/upload).
            </li>
            <li>
              <strong>Performa submitted:</strong> Next actor is a <strong>Super User</strong> for final approve or reject (remarks required).
            </li>
          </ul>
          {approval.status === "Submitted" ? (
            <p className="mt-2 text-amber-900/90">Current step: waiting for <strong>admin</strong> review.</p>
          ) : null}
          {approval.status === "Awaiting_Signed_Performa" ? (
            <p className="mt-2 text-amber-900/90">Current step: waiting for the <strong>requester</strong> to return the signed performa.</p>
          ) : null}
          {approval.status === "Performa_Submitted" ? (
            <p className="mt-2 text-amber-900/90">Current step: waiting for <strong>super user</strong> final decision.</p>
          ) : null}
        </div>
      ) : null}
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
              {leavePayload.leave_type ? (
                <div>
                  <dt className="text-zinc-500">Leave type</dt>
                  <dd>{leavePayload.leave_type}</dd>
                </div>
              ) : null}
              {leavePayload.guarantor_display_name ? (
                <div>
                  <dt className="text-zinc-500">Guarantor</dt>
                  <dd>{leavePayload.guarantor_display_name}</dd>
                </div>
              ) : null}
              {leavePayload.filled_performa_pdf_url ? (
                <div>
                  <dt className="text-zinc-500">Filled performa (for requester)</dt>
                  <dd>
                    <a
                      href={leavePayload.filled_performa_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Open PDF
                    </a>
                  </dd>
                </div>
              ) : null}
              {leavePayload.signed_performa_pdf_url ? (
                <div>
                  <dt className="text-zinc-500">Signed performa (returned)</dt>
                  <dd>
                    <a
                      href={leavePayload.signed_performa_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Open PDF
                    </a>
                    {leavePayload.performa_requester_message ? (
                      <span className="mt-1 block text-zinc-600">Note: {leavePayload.performa_requester_message}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </>
          )}
          {approval.approval_type === "asset_request" && assetPayload && (
            <>
              {assetPayload.asset_name ? (
                <div>
                  <dt className="text-zinc-500">Asset</dt>
                  <dd>{assetPayload.asset_name}</dd>
                </div>
              ) : null}
              {assetPayload.category ? (
                <div>
                  <dt className="text-zinc-500">Category</dt>
                  <dd>{assetPayload.category}</dd>
                </div>
              ) : null}
              {assetPayload.quantity != null ? (
                <div>
                  <dt className="text-zinc-500">Quantity</dt>
                  <dd>{assetPayload.quantity}</dd>
                </div>
              ) : null}
              {assetPayload.priority ? (
                <div>
                  <dt className="text-zinc-500">Priority</dt>
                  <dd>{assetPayload.priority}</dd>
                </div>
              ) : null}
              {assetPayload.reason ? (
                <div>
                  <dt className="text-zinc-500">Reason</dt>
                  <dd className="whitespace-pre-wrap">{assetPayload.reason}</dd>
                </div>
              ) : null}
            </>
          )}
          {approval.approval_type !== "leave_request" &&
            approval.approval_type !== "asset_request" &&
            approval.payload_json &&
            typeof approval.payload_json === "object" &&
            Object.keys(approval.payload_json as object).length > 0 && (
              <div>
                <dt className="text-zinc-500">Details</dt>
                <dd>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-zinc-100 p-3 text-xs">
                    {JSON.stringify(approval.payload_json, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          {approval.pm_comment && <div><dt className="text-zinc-500">GM comment</dt><dd>{approval.pm_comment}</dd></div>}
          {approval.admin_comment && <div><dt className="text-zinc-500">Admin comment</dt><dd>{approval.admin_comment}</dd></div>}
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
