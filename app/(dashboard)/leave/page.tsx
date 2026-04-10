import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminLeaveRequestForm } from "@/components/leave/AdminLeaveRequestForm";
import { isAdminPortalLeaveRequest } from "@/lib/approvals/leave-workflow";

function statusBadgeClass(status: string): string {
  if (status === "Completed") return "bg-emerald-100 text-emerald-800";
  if (status === "Admin_Rejected" || status === "PM_Rejected") return "bg-red-100 text-red-800";
  return "bg-indigo-100 text-indigo-900";
}

export default async function AdminLeavePage() {
  const userClient = await createServerSupabaseClient();
  const {
    data: { session },
  } = await userClient.auth.getSession();
  if (!session) redirect("/login?redirect=" + encodeURIComponent("/leave"));

  const supabase = await getDataClient();
  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, status, created_at, payload_json, pm_comment, admin_comment")
    .eq("requester_id", session.user.id)
    .eq("approval_type", "leave_request")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Leave</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Request leave from the admin portal. Super Users receive the request and give the final approval (no performa or
          guarantor). Employees who use the separate Employee Portal submit leave there (guarantor and performa workflow).
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Request leave</h2>
        <AdminLeaveRequestForm />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">My leave requests</h2>
        {!approvals?.length ? (
          <p className="mt-2 text-sm text-zinc-500">No leave requests yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {approvals.map((a) => {
              const payload = (a.payload_json as { from_date?: string; to_date?: string; reason?: string; leave_type?: string }) ?? {};
              const adminFlow = isAdminPortalLeaveRequest(a.payload_json);
              return (
                <li key={a.id} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900">
                      {payload.from_date ?? "—"} → {payload.to_date ?? "—"}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(a.status)}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {adminFlow ? (
                    <p className="mt-1 text-xs font-medium text-indigo-700">Admin portal request (Super User only)</p>
                  ) : null}
                  {payload.leave_type ? (
                    <p className="mt-1 text-sm text-zinc-600">Type: {payload.leave_type}</p>
                  ) : null}
                  {payload.reason ? <p className="mt-1 text-sm text-zinc-700">Reason: {payload.reason}</p> : null}
                  <Link href={`/approvals/${a.id}`} className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
                    View approval →
                  </Link>
                  {a.pm_comment || a.admin_comment ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Remarks: {a.pm_comment || a.admin_comment}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
