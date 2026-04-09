import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT, PERMISSION_EMPLOYEE_MANAGE } from "@/lib/rbac/permission-codes";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeForm } from "@/components/employees/EmployeeForm";

export default async function NewEmployeePage() {
  if (!(await can("users.create")) && !(await can(PERMISSION_EMPLOYEE_MANAGE))) redirect("/employees");

  const canAssignRegionProject = await can(PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">New employee</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Create the profile first. Region and project are assigned afterward
        {canAssignRegionProject ? (
          <>
            {" "}
            on{" "}
            <Link href="/employees/region-project-assignments" className="font-medium text-indigo-600 hover:text-indigo-800">
              Region &amp; project assignments
            </Link>
          </>
        ) : (
          <> (requires the &quot;Assign employee region &amp; project&quot; permission)</>
        )}
        .
      </p>
      <EmployeeForm existing={null} />
    </div>
  );
}
