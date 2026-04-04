"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable, type RowAction } from "@/components/ui/DataTable";

export type EmployeeDirectoryRow = Record<string, unknown> & {
  id: string;
  full_name?: string | null;
};

const columns = [
  { key: "full_name", label: "Full name" },
  { key: "passport_number", label: "Passport", format: "text" as const },
  { key: "country", label: "Country" },
  { key: "email", label: "Email", format: "text" as const },
  { key: "phone", label: "Phone", format: "text" as const },
  { key: "iqama_number", label: "Iqama", format: "text" as const },
  { key: "roles_display", label: "Roles" },
  { key: "region_name", label: "Region" },
  { key: "project_name", label: "Project" },
  { key: "assigned_vehicles_display", label: "Assigned vehicles" },
  { key: "onboarding_date", label: "Onboarding" },
  { key: "status", label: "Status" },
];

export function EmployeesDirectoryTable({
  data,
  canDelete,
}: {
  data: EmployeeDirectoryRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [teamsBlockingDelete, setTeamsBlockingDelete] = useState<{ id: string; name: string }[]>([]);
  const [pendingDelete, setPendingDelete] = useState<EmployeeDirectoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const executeDelete = useCallback(async () => {
    const row = pendingDelete;
    if (!row) return;
    setDeleting(true);
    setErrorBanner(null);
    setTeamsBlockingDelete([]);
    const res = await fetch(`/api/employees/${row.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setErrorBanner(typeof body.message === "string" ? body.message : "Could not delete employee");
      if (body.code === "EMPLOYEE_IN_USE_IN_TEAMS" && Array.isArray(body.teams)) {
        setTeamsBlockingDelete(body.teams);
      }
      setPendingDelete(null);
      return;
    }
    setPendingDelete(null);
    router.refresh();
  }, [pendingDelete, router]);

  const rowActions = useCallback(
    (row: EmployeeDirectoryRow): RowAction<EmployeeDirectoryRow>[] => {
      const actions: RowAction<EmployeeDirectoryRow>[] = [
        { label: "View", href: `/employees/${row.id}`, icon: "view" },
      ];
      if (canDelete) {
        actions.push({
          label: "Delete",
          icon: "delete",
          onClick: () => setPendingDelete(row),
        });
      }
      return actions;
    },
    [canDelete]
  );

  const pendingName = (pendingDelete?.full_name as string | undefined) || "this employee";

  return (
    <div className="space-y-3">
      {errorBanner ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{errorBanner}</p>
          {teamsBlockingDelete.length > 0 ? (
            <>
              <p className="mt-2 font-medium">Replace this employee in these teams first:</p>
              <ul className="mt-1 list-inside list-disc">
                {teamsBlockingDelete.map((t) => (
                  <li key={t.id}>
                    <Link href={`/teams/${t.id}`} className="text-red-700 underline hover:no-underline">
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <DataTable
        keyField="id"
        data={data}
        rowActions={rowActions}
        filterKeys={["status", "region_name"]}
        searchPlaceholder="Search employees…"
        columns={columns}
        multiSelect={canDelete}
        bulkDelete={
          canDelete
            ? { apiPath: "/api/employees/bulk-delete", entityLabel: "employees", confirmTitle: "Delete selected employees" }
            : undefined
        }
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete employee"
        message={`Delete ${pendingName}? This removes the employee record. If they have a portal login for this email, that account will be removed too.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={() => void executeDelete()}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
    </div>
  );
}
