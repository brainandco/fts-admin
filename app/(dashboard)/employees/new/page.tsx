import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeForm } from "@/components/employees/EmployeeForm";

export default async function NewEmployeePage() {
  if (!(await can("users.create"))) redirect("/employees");

  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user ?? false;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">New employee</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Create the profile first. Region and project are assigned afterward
        {isSuper ? (
          <>
            {" "}
            on{" "}
            <Link href="/employees/region-project-assignments" className="font-medium text-indigo-600 hover:text-indigo-800">
              Region &amp; project assignments
            </Link>
          </>
        ) : (
          <> (Super User)</>
        )}
        .
      </p>
      <EmployeeForm existing={null} />
    </div>
  );
}
