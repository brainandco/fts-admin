import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSuper } from "@/lib/rbac/permissions";
import { InviteUserForm } from "./InviteUserForm";

export default async function InviteUserPage() {
  const access = await requireSuper();
  if (!access.allowed) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/users" className="hover:text-zinc-900">Users</Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">Add user</span>
      </nav>
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-cyan-50 p-5 sm:p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Add user</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Invite an admin user by email: they get an invitation link first (no password). After they accept, they receive a second email with the portal link and login password. The account stays pending until they accept; then their status becomes Active and you can assign roles on their user page. Employees cannot be users; add them under Employees.
        </p>
        <div className="mt-4 inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700">
          Super-user action
        </div>
      </div>
      <InviteUserForm />
    </div>
  );
}
