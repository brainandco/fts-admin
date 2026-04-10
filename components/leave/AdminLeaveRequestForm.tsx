"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LEAVE_TYPES = [
  "Annual",
  "Sick",
  "Emergency",
  "Unpaid",
  "Marriage",
  "Bereavement",
  "Hajj / Umrah",
  "Other",
] as const;

export function AdminLeaveRequestForm() {
  const router = useRouter();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState<string>(LEAVE_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!fromDate || !toDate) {
      setMessage({ type: "error", text: "From date and to date are required." });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: "error", text: "Reason is required." });
      return;
    }
    if (!leaveType.trim()) {
      setMessage({ type: "error", text: "Leave type is required." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_date: fromDate,
          to_date: toDate,
          reason: reason.trim(),
          leave_type: leaveType.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.message ?? "Failed to submit" });
        return;
      }
      setMessage({ type: "success", text: "Leave request submitted. A Super User will review it." });
      setFromDate("");
      setToDate("");
      setReason("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 max-w-md space-y-4">
      <p className="text-sm text-zinc-600">
        Admin staff leave uses a short workflow: only a <strong>Super User</strong> approves or rejects (no guarantor or
        performa). You will be notified when there is a decision.
      </p>
      <div>
        <label htmlFor="admin_leave_type" className="mb-1 block text-sm font-medium text-zinc-700">
          Leave type
        </label>
        <select
          id="admin_leave_type"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="admin_from_date" className="mb-1 block text-sm font-medium text-zinc-700">
          From date
        </label>
        <input
          id="admin_from_date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
        />
      </div>
      <div>
        <label htmlFor="admin_to_date" className="mb-1 block text-sm font-medium text-zinc-700">
          To date
        </label>
        <input
          id="admin_to_date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
        />
      </div>
      <div>
        <label htmlFor="admin_reason" className="mb-1 block text-sm font-medium text-zinc-700">
          Reason <span className="text-red-600">*</span>
        </label>
        <textarea
          id="admin_reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          placeholder="Describe why you need leave (required)"
        />
      </div>
      {message ? (
        <p className={`text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit leave request"}
      </button>
    </form>
  );
}
