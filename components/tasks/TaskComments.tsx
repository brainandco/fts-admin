"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Comment = { id: string; user_id: string; body: string; created_at: string };

export function TaskComments({
  taskId,
  comments,
  userMap,
  currentUserId,
}: {
  taskId: string;
  comments: Comment[];
  userMap: Record<string, string>;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !currentUserId) return;
    setSaving(true);
    await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setBody("");
    setSaving(false);
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-zinc-900">Comments</h2>
      {currentUserId && (
        <form onSubmit={add} className="mb-4 flex gap-2">
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add comment…" className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving || !body.trim()} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">Add</button>
        </form>
      )}
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
            <p className="text-zinc-700">{c.body}</p>
            <p className="mt-1 text-zinc-400">{userMap[c.user_id] ?? c.user_id} · {new Date(c.created_at).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
