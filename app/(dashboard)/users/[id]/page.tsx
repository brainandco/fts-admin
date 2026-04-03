import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserRolesAndPermissions, REGIONAL_PM_ROLE_ID } from "@/lib/rbac/permissions";
import { getUserDependencies } from "@/lib/user-dependencies";
import { UserForm } from "@/components/users/UserForm";
import { DeleteUserButton } from "@/components/users/DeleteUserButton";
import { EntityHistory } from "@/components/audit/EntityHistory";

const SUPER_ROLE_ID = "a0000000-0000-0000-0000-000000000000";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_ACCESS: "bg-amber-100 text-amber-800 border-amber-200",
    ACTIVE: "bg-emerald-50 text-emerald-800 border-emerald-200",
    DISABLED: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  const style = styles[status] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${style}`}>
      {status === "PENDING_ACCESS" ? "Pending" : status === "ACTIVE" ? "Active" : "Disabled"}
    </span>
  );
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isSuper } = await getCurrentUserRolesAndPermissions();
  if (!isSuper) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.from("users_profile").select("*").eq("id", id).single();
  if (!user) notFound();

  const targetIsSuper = user.is_super_user ?? false;
  const { data: userRoles } = await supabase.from("user_roles").select("role_id").eq("user_id", id);
  const roleIds = (userRoles ?? []).map((r) => r.role_id);
  const hasSuperRole = (userRoles ?? []).some((r) => r.role_id === SUPER_ROLE_ID);
  const targetIsSuperOrRole = targetIsSuper || hasSuperRole;
  const { data: roles } = await supabase.from("roles").select("id, name").in("id", roleIds);
  const { data: allRolesRaw } = await supabase.from("roles").select("id, name");
  const allRoles = (allRolesRaw ?? []).filter((r) => r.id !== REGIONAL_PM_ROLE_ID && r.id !== SUPER_ROLE_ID);
  const preservedRoleIds: string[] = [];

  const dependencies = await getUserDependencies(supabase, id);

  const displayName = user.full_name || user.email || "User";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/users" className="hover:text-zinc-900">Users</Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-900">{displayName}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900">{displayName}</h1>
            <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={user.status} />
              {user.is_super_user && (
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
                  Super User
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!targetIsSuperOrRole && (
              <DeleteUserButton userId={id} userEmail={user.email} />
            )}
          </div>
        </div>
      </div>

      {/* Dependencies warning */}
      {!dependencies.canDeleteOrDisable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Before you delete or disable this user</h2>
          <p className="mb-3 text-sm text-amber-800">
            Unassign or transfer the following before deleting or setting status to Disabled.
          </p>
          <ul className="space-y-2 text-sm text-amber-800">
            {dependencies.blocks.map((b) => (
              <li key={b.key} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span><strong>{b.label}:</strong> {b.count} — {b.action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Profile & roles card */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Profile & roles</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Edit name, status, and assign roles. Roles determine access.</p>
        </div>
        <div className="p-6">
          <UserForm
            user={user}
            currentRoleIds={roleIds}
            allRoles={allRoles}
            preservedRoleIds={preservedRoleIds}
            emailConfirmed={true}
            hasSuperRole={hasSuperRole}
            canDemoteThisSuper={false}
            superRoleId={SUPER_ROLE_ID}
          />
        </div>
      </div>

      {/* Current roles summary (read-only) */}
      {(roles ?? []).length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Current roles</h2>
          <div className="flex flex-wrap gap-2">
            {(roles ?? []).map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700"
              >
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity history */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Activity history</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Recent changes to this user.</p>
        </div>
        <div className="p-6">
          <EntityHistory entityType="user" entityId={id} showTitle={false} />
        </div>
      </div>
    </div>
  );
}
