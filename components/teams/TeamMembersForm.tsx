"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; full_name: string | null; email: string };

export function TeamMembersForm({
  teamId,
  currentMemberIds,
  users,
}: {
  teamId: string;
  currentMemberIds: string[];
  users: User[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const available = users.filter((u) => !currentMemberIds.includes(u.id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setSaving(false);
    if (res.ok) {
      setUserId("");
      router.refresh();
    }
  }

  async function remove(memberId: string) {
    setSaving(true);
    await fetch(`/api/teams/${teamId}/members?userId=${memberId}`, { method: "DELETE" });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <form onSubmit={add} className="flex gap-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">Add member</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
        <button type="submit" disabled={saving || !userId} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">Add</button>
      </form>
      {currentMemberIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {currentMemberIds.map((uid) => {
            const u = users.find((x) => x.id === uid);
            return (
              <li key={uid} className="flex items-center gap-2 rounded bg-zinc-100 px-2 py-1 text-sm">
                {u?.full_name || u?.email || uid}
                <button type="button" onClick={() => remove(uid)} className="text-red-600 hover:underline">Remove</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
