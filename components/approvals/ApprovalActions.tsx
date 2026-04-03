"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Approval = { id: string; status: string };

export function ApprovalActions({ approval, allowActions = true }: { approval: Approval; allowActions?: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const canAct = allowActions && ["Submitted", "PM_Approved", "Admin_Approved"].includes(approval.status);

  async function act(action: "approve" | "reject") {
    setLoading(true);
    await fetch(`/api/approvals/${approval.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    setLoading(false);
    router.refresh();
  }

  if (!canAct) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-zinc-900">Actions</h2>
      {approval.status === "Admin_Approved" ? (
        <p className="mb-3 text-sm text-zinc-600">Final decision stage (Super User).</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-700">Comment</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" className="w-64 rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={() => act("approve")} disabled={loading} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
        <button type="button" onClick={() => act("reject")} disabled={loading} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
      </div>
    </section>
  );
}
