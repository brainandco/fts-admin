"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type Role = { id: string; name: string; description: string | null };
type Permission = { id: string; code: string; name: string | null; module: string | null };

export function RolesPermissionsManager() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addRole, setAddRole] = useState(false);
  const [addPerm, setAddPerm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);
  const [assigningRole, setAssigningRole] = useState<Role | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [savingAssign, setSavingAssign] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "role"; id: string; name: string } | { type: "perm"; id: string; code: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch("/api/settings/roles"),
        fetch("/api/settings/permissions"),
      ]);
      if (!rolesRes.ok || !permsRes.ok) {
        setError("Failed to load data");
        return;
      }
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      setRoles(rolesData);
      setPermissions(permsData);
      const rp: Record<string, string[]> = {};
      await Promise.all(
        rolesData.map(async (r: Role) => {
          const res = await fetch(`/api/settings/roles/${r.id}/permissions`);
          const ids = res.ok ? await res.json() : [];
          rp[r.id] = ids;
        })
      );
      setRolePerms(rp);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createRole(name: string, description: string) {
    const res = await fetch("/api/settings/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to create role");
    await load();
    setAddRole(false);
    router.refresh();
  }

  async function updateRole(id: string, name: string, description: string) {
    const res = await fetch(`/api/settings/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to update role");
    await load();
    setEditingRole(null);
    router.refresh();
  }

  async function saveRolePermissions(roleId: string, permissionIds: string[]) {
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/settings/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission_ids: permissionIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save");
      setRolePerms((prev) => ({ ...prev, [roleId]: permissionIds }));
      setAssigningRole(null);
      router.refresh();
    } finally {
      setSavingAssign(false);
    }
  }

  async function createPermission(code: string, name: string, module: string) {
    const res = await fetch("/api/settings/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name: name || null, module: module || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to create permission");
    await load();
    setAddPerm(false);
    router.refresh();
  }

  async function updatePermission(id: string, code: string, name: string, module: string) {
    const res = await fetch(`/api/settings/permissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name: name || null, module: module || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to update permission");
    await load();
    setEditingPerm(null);
    router.refresh();
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = deleteTarget.type === "role" ? `/api/settings/roles/${deleteTarget.id}` : `/api/settings/permissions/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete");
      setDeleteTarget(null);
      await load();
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-10">
      {/* Roles */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900">Roles</h2>
          <button
            type="button"
            onClick={() => setAddRole(true)}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add role
          </button>
        </div>
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-zinc-900">{role.name}</h3>
                  {role.description && <p className="text-sm text-zinc-500">{role.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(rolePerms[role.id] ?? []).map((pid) => {
                      const p = permissions.find((x) => x.id === pid);
                      return p ? <span key={p.id} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{p.code}</span> : null;
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingRole(role)} className="text-sm text-zinc-600 hover:text-zinc-900">Edit</button>
                  <button type="button" onClick={() => { setAssigningRole(role); setAssignSelected(new Set(rolePerms[role.id] ?? [])); }} className="text-sm text-zinc-600 hover:text-zinc-900">Assign permissions</button>
                  <button type="button" onClick={() => setDeleteTarget({ type: "role", id: role.id, name: role.name })} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Permissions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900">Permissions</h2>
          <button
            type="button"
            onClick={() => setAddPerm(true)}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add permission
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Code</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-700">Module</th>
                <th className="w-0 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="px-4 py-2 font-mono text-zinc-900">{p.code}</td>
                  <td className="px-4 py-2 text-zinc-700">{p.name ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{p.module ?? "—"}</td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => setEditingPerm(p)} className="text-zinc-600 hover:text-zinc-900">Edit</button>
                    {" · "}
                    <button type="button" onClick={() => setDeleteTarget({ type: "perm", id: p.id, code: p.code })} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add role modal */}
      {addRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddRole(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <RoleForm
              onSave={(name, desc) => createRole(name, desc)}
              onCancel={() => setAddRole(false)}
            />
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingRole(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <RoleForm
              initialName={editingRole.name}
              initialDescription={editingRole.description ?? ""}
              onSave={(name, desc) => updateRole(editingRole.id, name, desc)}
              onCancel={() => setEditingRole(null)}
            />
          </div>
        </div>
      )}

      {/* Assign permissions modal */}
      {assigningRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !savingAssign && setAssigningRole(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="font-medium text-zinc-900">Assign permissions: {assigningRole.name}</h3>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-4">
              <div className="space-y-2">
                {permissions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={assignSelected.has(p.id)}
                      onChange={(e) => setAssignSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(p.id); else next.delete(p.id); return next; })}
                    />
                    <span className="font-mono text-sm">{p.code}</span>
                    {p.name && <span className="text-zinc-500">{p.name}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">
              <button type="button" onClick={() => setAssigningRole(null)} disabled={savingAssign} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
              <button type="button" onClick={() => saveRolePermissions(assigningRole.id, Array.from(assignSelected))} disabled={savingAssign} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{savingAssign ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add permission modal */}
      {addPerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddPerm(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <PermissionForm
              onSave={(code, name, module) => createPermission(code, name, module)}
              onCancel={() => setAddPerm(false)}
            />
          </div>
        </div>
      )}

      {/* Edit permission modal */}
      {editingPerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingPerm(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <PermissionForm
              initialCode={editingPerm.code}
              initialName={editingPerm.name ?? ""}
              initialModule={editingPerm.module ?? ""}
              onSave={(code, name, module) => updatePermission(editingPerm.id, code, name, module)}
              onCancel={() => setEditingPerm(null)}
            />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? (deleteTarget.type === "role" ? "Delete role" : "Delete permission") : ""}
        message={deleteTarget ? (deleteTarget.type === "role" ? `Delete role "${deleteTarget.name}"? Users with this role will lose these permissions.` : `Delete permission "${deleteTarget.code}"? It will be removed from all roles.`) : ""}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}

function RoleForm({
  initialName = "",
  initialDescription = "",
  onSave,
  onCancel,
}: {
  initialName?: string;
  initialDescription?: string;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 font-medium text-zinc-900">{initialName ? "Edit role" : "New role"}</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-zinc-600">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-sm text-zinc-600">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function PermissionForm({
  initialCode = "",
  initialName = "",
  initialModule = "",
  onSave,
  onCancel,
}: {
  initialCode?: string;
  initialName?: string;
  initialModule?: string;
  onSave: (code: string, name: string, module: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [module, setModule] = useState(initialModule);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    try {
      await onSave(code.trim(), name.trim(), module.trim());
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 font-medium text-zinc-900">{initialCode ? "Edit permission" : "New permission"}</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-zinc-600">Code (e.g. feature.action)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono" required />
        </div>
        <div>
          <label className="block text-sm text-zinc-600">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-zinc-600">Module</label>
          <input value={module} onChange={(e) => setModule(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
