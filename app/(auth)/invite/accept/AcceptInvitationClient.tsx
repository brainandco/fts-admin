"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function AcceptInvitationInner() {
  const searchParams = useSearchParams();
  const tokenFromUrl = (searchParams.get("token") ?? "").trim();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    if (!tokenFromUrl) {
      setMessage("Missing invitation token. Open the link from your invitation email.");
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenFromUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.replace(
          "/login?message=" + encodeURIComponent("Check your email for your portal login details.")
        );
        return;
      }
      setMessage(typeof data.message === "string" ? data.message : "Could not accept invitation");
    } finally {
      setWorking(false);
    }
  }

  if (!tokenFromUrl) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Accept invitation</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use the link in your invitation email. It will open this page with a secure token.
        </p>
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-teal-800 underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Accept admin invitation</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          You don’t need to sign in here. Click the button below to confirm. We will email you the portal link and your password
          right after. Invitations expire 24 hours after they are sent.
        </p>
        <button
          type="button"
          disabled={working}
          onClick={() => void accept()}
          className="mt-6 w-full rounded-lg bg-teal-800 py-3 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {working ? "Working…" : "Accept invitation"}
        </button>
        {message && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
        )}
      </div>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="font-medium text-teal-800 underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function AcceptInvitationClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      }
    >
      <AcceptInvitationInner />
    </Suspense>
  );
}
