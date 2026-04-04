"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  is_super_user?: boolean;
};
type Role = { id: string; name: string };

export function UserForm({
  user,
  currentRoleIds,
  allRoles,
  preservedRoleIds = [],
  emailConfirmed = false,
  hasSuperRole = false,
  canDemoteThisSuper = false,
  superRoleId,
}: {
  user: User;
  currentRoleIds: string[];
  allRoles: Role[];
  /** Role ids not shown in UI but included on save (e.g. Regional PM assigned via Employee). */
  preservedRoleIds?: string[];
  /** If true, status and roles can be edited. New users are created ACTIVE with no confirmation. */
  emailConfirmed?: boolean;
  /** Target user has the Super role (in user_roles). */
  hasSuperRole?: boolean;
  /** Current user is the one who assigned the Super role to this user; can demote or delete. */
  canDemoteThisSuper?: boolean;
  /** Role id for Super User so we can enable/disable that checkbox. */
  superRoleId?: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">(user.status === "DISABLED" ? "DISABLED" : "ACTIVE");
  const [roleIds, setRoleIds] = useState<string[]>(currentRoleIds.filter((id) => !preservedRoleIds.includes(id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isSuperTarget = Boolean(user.is_super_user) || hasSuperRole;
  /** Invited users stay Pending until they accept; Super assigns roles after status becomes Active. */
  const statusLocked = user.status === "PENDING_ACCESS";
  const rolesLocked = statusLocked || status !== "ACTIVE";
  const superCheckboxDisabled = superRoleId ? isSuperTarget && !canDemoteThisSuper : isSuperTarget;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const finalRoleIds = [...roleIds, ...preservedRoleIds];
    if (!rolesLocked && finalRoleIds.length === 0) {
      setError("At least one role is required.");
      return;
    }
    setSaving(true);
    const payload: { full_name: string | null; status?: string; role_ids?: string[] } = {
      full_name: fullName || null,
    };
    if (!statusLocked) payload.status = status;
    const mayChangeRoles = !rolesLocked && (!isSuperTarget || canDemoteThisSuper);
    if (mayChangeRoles) payload.role_ids = finalRoleIds;
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    router.refresh();
  }

  function toggleRole(roleId: string) {
    setRoleIds((prev) => (prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]));
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
        {statusLocked ? (
          <div className="space-y-1">
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Pending — waiting for invitation acceptance
            </div>
            <p className="text-xs text-zinc-500">
              Status becomes Active automatically when they accept the invitation from their email. Then you can assign roles here.
            </p>
          </div>
        ) : (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Roles {!rolesLocked && <span className="text-red-600">*</span>}
        </label>
        {rolesLocked ? (
          <div className="rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            {statusLocked
              ? "Roles can be assigned after the user accepts their invitation (status becomes Active)."
              : "Roles can only be assigned when status is Active."}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {allRoles.map((r) => (
                <label key={r.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={roleIds.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    disabled={r.id === superRoleId ? superCheckboxDisabled : false}
                  />
                  {r.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Assign at least one role. Access is determined by roles.</p>
          </>
        )}
      </div>

      {isSuperTarget && !canDemoteThisSuper && (
        <p className="text-xs text-amber-700">Only the super user who assigned this user&apos;s super role can delete or demote them.</p>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="whitespace-pre-wrap">{error}</p>
        </div>
      )}
      <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
        {saving ? "Saving..." : "Update"}
      </button>
    </form>
  );
}
