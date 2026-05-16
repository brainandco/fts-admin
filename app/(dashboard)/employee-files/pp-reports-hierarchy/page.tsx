import Link from "next/link";
import { redirect } from "next/navigation";
import { PpReportsHierarchyManager } from "@/components/employee-files/PpReportsHierarchyManager";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";

export default async function PpReportsHierarchyPage() {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    redirect("/dashboard");
  }

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
        <span className="text-zinc-900">PP reports folder hierarchy</span>
      </nav>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">PP final reports folder hierarchy</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Manage operators, accounts, and projects that PP / Reporting Team members can select when creating folders in the
          final reports bucket. Regions are taken from the existing Regions module (not edited here).
        </p>
        <p className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/employee-files/pp-reports" className="font-medium text-indigo-700 hover:underline">
            Open PP final reports bucket
          </Link>
        </p>
      </div>
      <PpReportsHierarchyManager />
    </div>
  );
}
