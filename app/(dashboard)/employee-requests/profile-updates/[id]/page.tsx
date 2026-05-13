import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ProfileUpdateRequestActions } from "@/components/employee-requests/ProfileUpdateRequestActions";

export default async function ProfileUpdateRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("employees.manage"))) redirect("/dashboard");

  const { id } = await params;
  const supabase = await getDataClient();

  const { data: row } = await supabase
    .from("employee_profile_update_requests")
    .select(
      "id, employee_id, status, requested_full_name, requested_phone, requested_email, note_from_employee, created_at, resolved_at, resolved_by_user_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name, phone, email")
    .eq("id", row.employee_id)
    .maybeSingle();

  const resolverId = row.resolved_by_user_id;
  const { data: resolver } = resolverId
    ? await supabase.from("users_profile").select("full_name, email").eq("id", resolverId).maybeSingle()
    : { data: null };

  const isPending = row.status === "pending";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <Link href="/employee-requests" className="hover:text-zinc-900">
          Employee requests
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-zinc-800">Profile update</span>
      </nav>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Profile change request</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{emp?.full_name ?? "Employee"}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Submitted {new Date(row.created_at).toLocaleString()} ·{" "}
              <span className="font-medium capitalize text-zinc-800">{row.status}</span>
            </p>
          </div>
          <Link
            href={`/employees/${row.employee_id}`}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Open employee
          </Link>
        </div>

        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Current name</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{emp?.full_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Current phone</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{emp?.phone?.trim() ? emp.phone : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Current email</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{emp?.email ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-8 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
          <h2 className="text-sm font-semibold text-teal-900">Requested values</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-teal-950">
            {row.requested_full_name ? <li>Name → {row.requested_full_name}</li> : null}
            {row.requested_phone ? <li>Phone → {row.requested_phone}</li> : null}
            {row.requested_email ? <li>Email → {row.requested_email}</li> : null}
            {!row.requested_full_name && !row.requested_phone && !row.requested_email ? <li>—</li> : null}
          </ul>
          {row.note_from_employee ? (
            <p className="mt-3 text-sm text-teal-900/90">
              <span className="font-medium">Employee note:</span> {row.note_from_employee}
            </p>
          ) : null}
        </div>

        {!isPending && row.resolved_at ? (
          <p className="mt-6 text-sm text-zinc-600">
            Resolved {new Date(row.resolved_at).toLocaleString()}
            {resolver ? (
              <>
                {" "}
                by {resolver.full_name?.trim() || resolver.email || row.resolved_by_user_id}
              </>
            ) : null}
            .
          </p>
        ) : null}

        <div className="mt-8 border-t border-zinc-100 pt-6">
          {isPending ? (
            <ProfileUpdateRequestActions requestId={row.id} />
          ) : (
            <p className="text-sm text-zinc-500">This request is closed.</p>
          )}
        </div>
      </div>
    </div>
  );
}
