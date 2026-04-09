"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Approval = { id: string; status: string; approval_type?: string };

function actionableStatuses(approvalType: string | undefined, status: string): boolean {
  if (approvalType === "leave_request") {
    return status === "Submitted" || status === "Performa_Submitted";
  }
  if (approvalType === "asset_request") {
    return status === "Submitted" || status === "Admin_Approved";
  }
  return ["Submitted", "PM_Approved", "Admin_Approved"].includes(status);
}

export function ApprovalActions({ approval, allowActions = true }: { approval: Approval; allowActions?: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const canAct = allowActions && actionableStatuses(approval.approval_type, approval.status);

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
    <section
      className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5"
      aria-labelledby="approval-actions-heading"
    >
      <div className="border-b border-zinc-100 bg-gradient-to-r from-emerald-50/50 to-zinc-50/80 px-5 py-4 sm:px-6">
        <h2 id="approval-actions-heading" className="text-base font-semibold tracking-tight text-zinc-900">
          Review & decision
        </h2>
        <p className="mt-1 text-sm text-zinc-600">Add remarks and choose an outcome. Required fields depend on the workflow stage.</p>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {approval.approval_type === "asset_request" && approval.status === "Admin_Approved" ? (
          <p className="text-sm text-zinc-600">Final decision stage (Super User).</p>
        ) : null}
        {approval.approval_type === "leave_request" && approval.status === "Performa_Submitted" ? (
          <p className="text-sm text-zinc-600">
            Final decision after signed performa: add remarks when you approve or reject (required).
          </p>
        ) : null}
        {(approval.approval_type === "leave_request" || approval.approval_type === "asset_request") &&
        approval.status === "Submitted" ? (
          <p className="text-sm text-zinc-600">Admin review: add remarks when you approve or reject (required).</p>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:max-w-xl">
            <label htmlFor="approval-comment" className="mb-1.5 block text-sm font-medium text-zinc-700">
              Comment / remarks
            </label>
            <textarea
              id="approval-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter your remarks…"
              rows={3}
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => act("approve")}
              disabled={loading}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
            >
              {loading ? "Working…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => act("reject")}
              disabled={loading}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
            >
              {loading ? "Working…" : "Reject"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
