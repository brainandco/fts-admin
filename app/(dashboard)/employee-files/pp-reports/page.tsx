import Link from "next/link";
import { redirect } from "next/navigation";
import { PpReportsBucketClient } from "@/components/employee-files/PpReportsBucketClient";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { isPpReportsBucketConfigured } from "@/lib/wasabi/s3-client";

export default async function AdminPpReportsPage() {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    redirect("/dashboard");
  }

  const configured = isPpReportsBucketConfigured();

  return (
    <div className="space-y-5 pb-10">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:text-zinc-900">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/employee-files" className="hover:text-zinc-900">
          Employee files
        </Link>
        <span>/</span>
        <span className="text-zinc-900">PP final reports</span>
      </nav>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">PP final reports bucket</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Same Wasabi bucket Post Processors use for finished reports. Admins with employee-files access can browse, upload,
          download, and delete here alongside the regional employee field workspace.
        </p>
      </div>
      <PpReportsBucketClient configured={configured} />
    </div>
  );
}
