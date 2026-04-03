import { requireSuper } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { RolesPermissionsManager } from "@/components/settings/RolesPermissionsManager";

export default async function RolesPage() {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) redirect("/dashboard");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">Roles & permissions</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Only Super User can manage roles and permissions. Create custom roles, define permissions, and assign them to roles. Then assign roles to users (Users → edit user) to grant portal access according to those permissions. Admins and employees are restricted by their assigned roles and permissions.
      </p>
      <RolesPermissionsManager />
    </div>
  );
}
