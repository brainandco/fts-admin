import { getDataClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ApprovalActions } from "@/components/approvals/ApprovalActions";
import { EntityHistory } from "@/components/audit/EntityHistory";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { leaveRequestTracking } from "@/lib/employee-requests/leave-metrics";

function statusHeaderBadgeClass(status: string): string {
  const s = String(status).toLowerCase();
  if (s === "completed") return "bg-emerald-100 text-emerald-900 ring-emerald-600/20";
  if (s.includes("rejected")) return "bg-red-100 text-red-900 ring-red-600/20";
  if (s === "submitted") return "bg-indigo-100 text-indigo-900 ring-indigo-600/20";
  if (s.includes("awaiting_signed_performa")) return "bg-amber-100 text-amber-950 ring-amber-600/25";
  if (s.includes("performa_submitted")) return "bg-violet-100 text-violet-900 ring-violet-600/20";
  if (s.includes("admin_approved")) return "bg-sky-100 text-sky-900 ring-sky-600/20";
  return "bg-zinc-200 text-zinc-800 ring-zinc-500/15";
}

const cardShell =
  "overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5";
const cardHeader =
  "border-b border-zinc-100 bg-gradient-to-r from-zinc-50/90 to-indigo-50/30 px-5 py-4 sm:px-6";
const cardTitle = "text-base font-semibold tracking-tight text-zinc-900";
const cardSubtitle = "mt-1 text-sm text-zinc-600";

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

  const payloadRecord =
    approval.payload_json && typeof approval.payload_json === "object" && !Array.isArray(approval.payload_json)
      ? (approval.payload_json as Record<string, unknown>)
      : {};
  const snapshotRequesterName = String(payloadRecord.requester_display_name ?? payloadRecord.requester_name ?? "").trim();

  let employeeRequesterName = "";
  if (!requester?.full_name?.trim() && requester?.email) {
    const { data: empRow } = await supabase
      .from("employees")
      .select("full_name")
      .eq("email", requester.email.trim().toLowerCase())
      .maybeSingle();
    employeeRequesterName = (empRow?.full_name ?? "").trim();
  }

  const requesterDisplayName =
    (requester?.full_name ?? "").trim() ||
    snapshotRequesterName ||
    employeeRequesterName ||
    requester?.email ||
    approval.requester_id;
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
          requester_job_title?: string;
          guarantor_display_name?: string;
          guarantor_job_title?: string;
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

  /** Same template row the approve API uses (oldest marked template first). Shown only to admin at Submitted. */
  let leavePerformaTemplateForAdmin: { file_url: string; title: string | null } | null = null;
  if (
    approval.approval_type === "leave_request" &&
    approval.status === "Submitted" &&
    isAdminNonSuper
  ) {
    const { data: tpl } = await supabase
      .from("company_documents")
      .select("file_url, title")
      .eq("is_leave_performa_template", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (tpl?.file_url && typeof tpl.file_url === "string") {
      leavePerformaTemplateForAdmin = { file_url: tpl.file_url, title: tpl.title ?? null };
    }
  }

  const blockApproveWithoutLeavePerformaTemplate =
    approval.approval_type === "leave_request" &&
    approval.status === "Submitted" &&
    isAdminNonSuper &&
    !leavePerformaTemplateForAdmin;

  const detailRow =
    "grid gap-1 border-b border-zinc-100 py-3.5 last:border-0 sm:grid-cols-[minmax(7.5rem,11rem)_1fr] sm:items-start sm:gap-x-6";
  const dtClass = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
  const ddClass = "text-sm leading-relaxed text-zinc-900";
  const linkClass =
    "inline-flex items-center gap-1 font-medium text-indigo-600 decoration-indigo-200 underline-offset-2 hover:text-indigo-800 hover:underline";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-4">
      <div className={cardShell}>
        <div className="flex flex-col gap-4 border-b border-zinc-100 bg-gradient-to-r from-indigo-50/60 via-white to-zinc-50/90 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 space-y-3">
            <Link
              href="/approvals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
            >
              <span aria-hidden className="text-lg leading-none">
                ←
              </span>
              Back to approvals
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                {approval.approval_type.replace(/_/g, " ")}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${statusHeaderBadgeClass(approval.status)}`}
              >
                {approval.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {approval.approval_type === "asset_request" ? (
        <div className={cardShell}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>How this workflow runs</h2>
            <p className={cardSubtitle}>
              Admin reviews first (remarks required), then a Super User gives the final approve or reject decision (remarks
              required).
            </p>
          </div>
        </div>
      ) : null}

      {approval.approval_type === "leave_request" ? (
        <div className={cardShell}>
          <div className={`${cardHeader} border-amber-100/80 bg-gradient-to-r from-amber-50/90 to-orange-50/40`}>
            <h2 className={cardTitle}>Leave performa workflow</h2>
            <p className={cardSubtitle}>Stages from submission through signed performa and final sign-off.</p>
          </div>
          <div className="space-y-3 px-5 py-5 text-sm text-zinc-700 sm:px-6">
            <ul className="list-inside list-disc space-y-2 marker:text-amber-700">
              <li>
                <strong className="text-zinc-900">Submitted:</strong> an <strong>Admin</strong> reviews (remarks required).
                Approve generates a filled PDF for the requester.
              </li>
              <li>
                <strong className="text-zinc-900">Awaiting signed performa:</strong> the <strong>requester</strong> prints,
                signs, and uploads.
              </li>
              <li>
                <strong className="text-zinc-900">Performa submitted:</strong> a <strong>Super User</strong> gives the final
                decision (remarks required).
              </li>
            </ul>
            {approval.status === "Submitted" ? (
              <p className="rounded-lg bg-amber-100/50 px-3 py-2 text-amber-950">
                Current step: waiting for <strong>admin</strong> review.
              </p>
            ) : null}
            {approval.status === "Awaiting_Signed_Performa" ? (
              <p className="rounded-lg bg-amber-100/50 px-3 py-2 text-amber-950">
                Current step: waiting for the <strong>requester</strong> to return the signed performa.
              </p>
            ) : null}
            {approval.status === "Performa_Submitted" ? (
              <p className="rounded-lg bg-amber-100/50 px-3 py-2 text-amber-950">
                Current step: waiting for <strong>super user</strong> final decision.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {leavePerformaTemplateForAdmin ? (
        <section className={cardShell} aria-labelledby="leave-performa-heading">
          <div className={cardHeader}>
            <h2 id="leave-performa-heading" className={cardTitle}>
              Leave performa
            </h2>
            <p className={cardSubtitle}>
              When you approve, this PDF is filled with the requester&apos;s details and sent to the employee (same document).
            </p>
          </div>
          <div className="px-5 pb-5 pt-2 sm:px-6">
            <a
              href={leavePerformaTemplateForAdmin.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} text-sm`}
            >
              {leavePerformaTemplateForAdmin.title?.trim() || "Open performa PDF"}
            </a>
            <div className="mt-4 h-[min(70vh,560px)] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100/80 shadow-inner">
              <iframe
                title="Leave performa preview"
                src={leavePerformaTemplateForAdmin.file_url}
                className="h-full min-h-[320px] w-full border-0"
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className={cardShell} aria-labelledby="request-details-heading">
        <div className={cardHeader}>
          <h2 id="request-details-heading" className={cardTitle}>
            Request details
          </h2>
          <p className={cardSubtitle}>Core fields submitted with this approval.</p>
        </div>
        <div className="px-5 pb-2 pt-1 sm:px-6">
          <dl className="text-sm">
          <div className={detailRow}>
            <dt className={dtClass}>Requester</dt>
            <dd className={ddClass}>{requesterDisplayName}</dd>
          </div>
          <div className={detailRow}>
            <dt className={dtClass}>Submitted</dt>
            <dd className={`${ddClass} tabular-nums`}>{new Date(approval.created_at).toLocaleString()}</dd>
          </div>
          {approval.approval_type === "leave_request" && leavePayload && (
            <>
              <div className={detailRow}>
                <dt className={dtClass}>Leave period</dt>
                <dd className={ddClass}>
                  {leavePayload.from_date ?? "—"} → {leavePayload.to_date ?? "—"}
                  {leaveMetrics ? (
                    <span className="ml-2 text-zinc-600">
                      ({leaveMetrics.requestedDays} day{leaveMetrics.requestedDays === 1 ? "" : "s"} requested)
                    </span>
                  ) : null}
                </dd>
              </div>
              {leaveMetrics ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Tracking</dt>
                  <dd className={ddClass}>{leaveMetrics.tracking}</dd>
                </div>
              ) : null}
              {leaveMetrics?.daysLeftInLeave != null ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Days left in this leave</dt>
                  <dd className={ddClass}>{leaveMetrics.daysLeftInLeave}</dd>
                </div>
              ) : null}
              {leavePayload.reason ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Reason</dt>
                  <dd className={ddClass}>{leavePayload.reason}</dd>
                </div>
              ) : null}
              {leavePayload.leave_type ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Leave type</dt>
                  <dd className={ddClass}>{leavePayload.leave_type}</dd>
                </div>
              ) : null}
              {leavePayload.requester_job_title ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Requester role(s)</dt>
                  <dd className={ddClass}>{leavePayload.requester_job_title}</dd>
                </div>
              ) : null}
              {leavePayload.guarantor_display_name ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Guarantor</dt>
                  <dd className={ddClass}>{leavePayload.guarantor_display_name}</dd>
                </div>
              ) : null}
              {leavePayload.guarantor_job_title ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Guarantor role(s)</dt>
                  <dd className={ddClass}>{leavePayload.guarantor_job_title}</dd>
                </div>
              ) : null}
              {leavePayload.filled_performa_pdf_url ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Filled performa (for requester)</dt>
                  <dd className={ddClass}>
                    <a href={leavePayload.filled_performa_pdf_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      Open PDF
                    </a>
                  </dd>
                </div>
              ) : null}
              {leavePayload.signed_performa_pdf_url ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Signed performa (returned)</dt>
                  <dd className={ddClass}>
                    <a
                      href={leavePayload.signed_performa_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      Open PDF
                    </a>
                    {leavePayload.performa_requester_message ? (
                      <span className="mt-2 block text-sm text-zinc-600">Note: {leavePayload.performa_requester_message}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </>
          )}
          {approval.approval_type === "asset_request" && assetPayload && (
            <>
              {assetPayload.asset_name ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Asset</dt>
                  <dd className={ddClass}>{assetPayload.asset_name}</dd>
                </div>
              ) : null}
              {assetPayload.category ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Category</dt>
                  <dd className={ddClass}>{assetPayload.category}</dd>
                </div>
              ) : null}
              {assetPayload.quantity != null ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Quantity</dt>
                  <dd className={ddClass}>{assetPayload.quantity}</dd>
                </div>
              ) : null}
              {assetPayload.priority ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Priority</dt>
                  <dd className={ddClass}>{assetPayload.priority}</dd>
                </div>
              ) : null}
              {assetPayload.reason ? (
                <div className={detailRow}>
                  <dt className={dtClass}>Reason</dt>
                  <dd className={`${ddClass} whitespace-pre-wrap`}>{assetPayload.reason}</dd>
                </div>
              ) : null}
            </>
          )}
          {approval.approval_type !== "leave_request" &&
            approval.approval_type !== "asset_request" &&
            approval.payload_json &&
            typeof approval.payload_json === "object" &&
            Object.keys(approval.payload_json as object).length > 0 && (
              <div className={detailRow}>
                <dt className={dtClass}>Details</dt>
                <dd className={ddClass}>
                  <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800">
                    {JSON.stringify(approval.payload_json, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          {approval.pm_comment ? (
            <div className={detailRow}>
              <dt className={dtClass}>GM comment</dt>
              <dd className={ddClass}>{approval.pm_comment}</dd>
            </div>
          ) : null}
          {approval.admin_comment ? (
            <div className={detailRow}>
              <dt className={dtClass}>Admin comment</dt>
              <dd className={ddClass}>{approval.admin_comment}</dd>
            </div>
          ) : null}
        </dl>
        </div>
      </section>

      {approval.approval_type === "leave_request" && (
        <section className={cardShell} aria-labelledby="leave-history-heading">
          <div className={cardHeader}>
            <h2 id="leave-history-heading" className={cardTitle}>
              Leave history (this requester)
            </h2>
            <p className={cardSubtitle}>Recent leave approvals for the same person, newest first.</p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            {!(leaveHistory.data ?? []).length ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-10 text-center">
                <p className="text-sm font-medium text-zinc-600">No other leave requests found</p>
                <p className="mt-1 text-xs text-zinc-500">New submissions will show up here.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {(leaveHistory.data ?? []).map((h) => {
                  const payload = (h.payload_json as { from_date?: string; to_date?: string; reason?: string }) ?? {};
                  const isCurrent = h.id === id;
                  return (
                    <li
                      key={h.id}
                      className={`relative rounded-xl border p-4 text-sm shadow-sm transition ${
                        isCurrent
                          ? "border-indigo-300 bg-indigo-50/40 ring-2 ring-indigo-200/60"
                          : "border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50"
                      }`}
                    >
                      {isCurrent ? (
                        <span className="absolute -right-1 -top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                          This request
                        </span>
                      ) : null}
                      <div className="flex flex-wrap items-start justify-between gap-2 pr-2">
                        <span className="font-semibold text-zinc-900">
                          {payload.from_date ?? "—"} → {payload.to_date ?? "—"}
                        </span>
                        <span
                          className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusHeaderBadgeClass(h.status)}`}
                        >
                          {h.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {payload.reason ? <p className="mt-2 text-zinc-700">Reason: {payload.reason}</p> : null}
                      {h.admin_comment || h.pm_comment ? (
                        <p className="mt-2 border-t border-zinc-200/80 pt-2 text-xs text-zinc-600">
                          <span className="font-medium text-zinc-700">Remarks:</span> {h.admin_comment || h.pm_comment}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs tabular-nums text-zinc-400">
                        {new Date(h.created_at).toLocaleString()}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
      <ApprovalActions
        approval={approval}
        allowActions={allowActions}
        blockApproveWithoutLeavePerformaTemplate={blockApproveWithoutLeavePerformaTemplate}
      />
      <EntityHistory entityType="approval" entityId={id} />
    </div>
  );
}
