import { Suspense } from "react";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { AuditLogExplorer } from "@/components/audit/AuditLogExplorer";

export default async function AuditPage() {
  if (!(await can("audit_logs.view_all"))) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Activity & audit trail</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Complete tracking across the admin and employee portals—uploads, downloads, data changes, assignments,
          approvals, exports, and API access. Events are recorded automatically; detailed actions include file names
          and change data where available.
        </p>
      </div>
      <Suspense fallback={<div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-500">Loading audit trail…</div>}>
        <AuditLogExplorer />
      </Suspense>
    </div>
  );
}
